import {
  Controller,
  Post,
  Body,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ImportsService } from "./imports.service";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { Tenant } from "../common/tenant.decorator";

@Controller("imports")
@UseGuards(ClerkAuthGuard)
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post("parse")
  async parse(
    @Body() body: { csv: string },
    @Tenant("organizationId") _orgId?: string,
  ) {
    const { rows, errors } = await this.importsService.parseCsv(body.csv ?? "");
    return { rows, errors };
  }

  @Post("duplicates")
  async detectDuplicates(
    @Body() body: { businessId: string; rows: Array<{ name: string; mobile?: string; notes?: string; rowIndex: number }> },
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

  @Post("commit")
  async commit(
    @Body() body: {
      businessId: string;
      rows: Array<{ name: string; mobile?: string; notes?: string; rowIndex: number }>;
      skipRows?: number[];
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
    );
    return result;
  }
}
