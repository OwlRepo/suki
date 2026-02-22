import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ImportsService } from "./imports.service";
import { MigrationService } from "./migration.service";
import { MappingService } from "./mapping.service";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { Tenant } from "../common/tenant.decorator";
import { fetchHubSpotContacts } from "./providers/hubspot.provider";
import { fetchPipedrivePersons } from "./providers/pipedrive.provider";
import type { MigrationEntity } from "./migration-types";

@Controller("imports")
@UseGuards(ClerkAuthGuard)
export class ImportsController {
  constructor(
    private readonly importsService: ImportsService,
    private readonly migrationService: MigrationService,
    private readonly mappingService: MappingService,
  ) {}

  @Post("fetch-provider")
  async fetchProvider(
    @Body() body: { provider: "hubspot" | "pipedrive"; credentials: { accessToken?: string; apiToken?: string } },
  ) {
    if (!body.provider || !body.credentials) {
      throw new BadRequestException("provider and credentials required");
    }
    if (body.provider === "hubspot") {
      const token = body.credentials.accessToken;
      if (!token) throw new BadRequestException("HubSpot requires accessToken");
      const contacts = await fetchHubSpotContacts(token);
      const rows = contacts.map((c, i) => ({
        name: [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "Unknown",
        mobile: c.mobile,
        email: c.email,
        notes: c.tags?.join(", "),
        rowIndex: i + 2,
      }));
      return { rows, source: "hubspot" };
    }
    if (body.provider === "pipedrive") {
      const token = body.credentials.apiToken;
      if (!token) throw new BadRequestException("Pipedrive requires apiToken");
      const contacts = await fetchPipedrivePersons(token);
      const rows = contacts.map((c, i) => ({
        name: [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "Unknown",
        mobile: c.mobile,
        email: c.email,
        notes: c.tags?.join(", "),
        rowIndex: i + 2,
      }));
      return { rows, source: "pipedrive" };
    }
    throw new BadRequestException("Unsupported provider");
  }

  @Post("parse")
  async parse(
    @Body() body: { csv?: string; xlsxBase64?: string },
    @Tenant("organizationId") _orgId?: string,
  ) {
    if (body.xlsxBase64) {
      const { rows, errors } = await this.importsService.parseXlsx(body.xlsxBase64);
      return { rows, errors };
    }
    const { rows, errors } = await this.importsService.parseCsv(body.csv ?? "");
    return { rows, errors };
  }

  @Post("parse-ocr")
  async parseOcr(
    @Body() body: { imageBase64: string },
    @Tenant("organizationId") _orgId?: string,
  ) {
    const result = await this.importsService.parseOcr(body.imageBase64 ?? "");
    return result;
  }

  @Post("duplicates")
  async detectDuplicates(
    @Body() body: { businessId: string; rows: Array<{ name: string; mobile?: string; email?: string; notes?: string; rowIndex: number }> },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!body.businessId || !orgId) throw new BadRequestException("businessId required");
    const matches = await this.importsService.detectDuplicates(
      body.businessId,
      orgId,
      body.rows,
    );
    return { duplicates: matches };
  }

  @Post("dry-run")
  async dryRun(
    @Body() body: {
      businessId: string;
      rows: Array<Record<string, unknown> & { name?: string; mobile?: string; notes?: string; rowIndex: number }>;
      skipRows?: number[];
      entityType?: MigrationEntity;
    },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!body.businessId || !body.rows?.length || !orgId) {
      throw new BadRequestException("businessId and rows required");
    }
    const skipSet = new Set(body.skipRows ?? []);
    const rowShape = body.rows.map((r) => ({
      name: (r.name as string) ?? "",
      mobile: r.mobile as string | undefined,
      notes: r.notes as string | undefined,
      rowIndex: r.rowIndex,
    }));
    const matches = await this.importsService.detectDuplicates(
      body.businessId,
      orgId,
      rowShape,
    );
    return this.migrationService.runDryRun(
      body.businessId,
      orgId,
      body.rows,
      skipSet,
      matches.map((m) => ({ rowIndex: m.rowIndex })),
      body.entityType ?? "contacts",
    );
  }

  @Post("commit")
  async commit(
    @Body() body: {
      businessId: string;
      rows: Array<{ name: string; mobile?: string; email?: string; notes?: string; rowIndex: number }>;
      skipRows?: number[];
      source?: string;
    },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!body.businessId || !body.rows?.length || !orgId) {
      throw new BadRequestException("businessId and rows required");
    }
    const skipSet = new Set(body.skipRows ?? []);
    const result = await this.importsService.commitImport(
      body.businessId,
      orgId,
      body.rows,
      skipSet,
      body.source ?? "csv",
    );
    return result;
  }

  @Post("validate")
  async validate(
    @Body() body: {
      rows: Array<Record<string, unknown> & { rowIndex: number }>;
      entityType?: MigrationEntity;
    },
    @Tenant("organizationId") _orgId?: string,
  ) {
    if (!body.rows?.length) {
      throw new BadRequestException("rows required");
    }
    return this.migrationService.validateBatch(body.rows, {
      entityType: body.entityType ?? "contacts",
    });
  }

  @Post("mapping-suggest")
  async suggestMappings(
    @Body() body: {
      headers: string[];
      entityType?: MigrationEntity;
    },
  ) {
    if (!body.headers?.length) {
      throw new BadRequestException("headers required");
    }
    return {
      mappings: this.mappingService.suggestMappings(
        body.headers,
        body.entityType ?? "contacts",
      ),
    };
  }

  @Post("mapping-preview")
  async mappingPreview(
    @Body() body: {
      rows: Array<Record<string, unknown> & { rowIndex?: number }>;
      mappings: Array<{ sourceField: string; targetField: string; entityType?: MigrationEntity; transform?: string }>;
      limit?: number;
    },
  ) {
    if (!body.rows?.length || !body.mappings?.length) {
      throw new BadRequestException("rows and mappings required");
    }
    return {
      preview: this.mappingService.previewMappedRows(
        body.rows,
        body.mappings as import("./migration-types").FieldMapping[],
        body.limit ?? 10,
      ),
    };
  }

  @Get("batches")
  async listBatches(
    @Query("businessId") businessId: string | undefined,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new BadRequestException("Unauthorized");
    return this.importsService.listBatches(orgId, businessId);
  }

  @Get("batches/:batchId")
  async getBatch(
    @Param("batchId") batchId: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new BadRequestException("Unauthorized");
    return this.importsService.getBatch(batchId, orgId);
  }

  @Post("batches/:batchId/rollback")
  async rollback(
    @Param("batchId") batchId: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new BadRequestException("Unauthorized");
    return this.migrationService.rollbackBatch(batchId, orgId);
  }
}
