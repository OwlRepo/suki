import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { CustomersService } from "./customers.service";
import { CustomerTemplatesService } from "./customer-templates.service";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { Tenant } from "../common/tenant.decorator";

@Controller("customers")
@UseGuards(ClerkAuthGuard)
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly templatesService: CustomerTemplatesService,
  ) {}

  @Get()
  async list(
    @Query("businessId") businessId: string,
    @Query("search") search?: string,
    @Query("tag") tag?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!businessId || !orgId) throw new BadRequestException("businessId required");
    return this.customersService.list(businessId, orgId, {
      search,
      tag,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get("duplicate-candidates")
  async duplicateCandidates(
    @Query("businessId") businessId: string,
    @Query("limit") limitStr?: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!businessId || !orgId) throw new BadRequestException("businessId required");
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    return this.customersService.findDuplicateCandidates(businessId, orgId, {
      limit: limit != null && !isNaN(limit) ? limit : undefined,
    });
  }

  @Get("audience-count")
  async audienceCount(
    @Query("businessId") businessId: string,
    @Query("minVisits") minVisitsStr?: string,
    @Query("maxInactiveDays") maxInactiveDaysStr?: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!businessId || !orgId) throw new BadRequestException("businessId required");
    const minVisits = minVisitsStr ? parseInt(minVisitsStr, 10) : undefined;
    const maxInactiveDays = maxInactiveDaysStr ? parseInt(maxInactiveDaysStr, 10) : undefined;
    const count = await this.customersService.countByFilter(businessId, orgId, {
      minVisits: minVisits != null && !isNaN(minVisits) ? minVisits : undefined,
      maxInactiveDays: maxInactiveDays != null && !isNaN(maxInactiveDays) ? maxInactiveDays : undefined,
    });
    return { count };
  }

  @Get("templates")
  async listTemplates(
    @Query("businessId") businessId: string,
    @Query("businessType") businessType: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new BadRequestException("Unauthorized");
    return this.templatesService.list(orgId, {
      businessId: businessId || undefined,
      businessType: businessType || undefined,
    });
  }

  @Get("default-template")
  async getDefaultTemplate(
    @Query("businessId") businessId: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!businessId || !orgId) throw new BadRequestException("businessId required");
    return this.templatesService.getDefaultTemplate(businessId, orgId);
  }

  @Post("templates")
  async createTemplate(
    @Body()
    body: {
      name: string;
      businessId?: string;
      businessType?: string;
      fieldsConfig: Array<{ key: string; label: string; placeholder?: string }>;
      sortOrder?: number;
    },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!body.name?.trim() || !orgId) throw new BadRequestException("name required");
    return this.templatesService.create(orgId, {
      name: body.name,
      businessId: body.businessId,
      businessType: body.businessType,
      fieldsConfig: body.fieldsConfig ?? [],
      sortOrder: body.sortOrder,
    });
  }

  @Get("templates/:templateId")
  async getTemplate(
    @Param("templateId") templateId: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    return this.templatesService.getById(templateId, orgId);
  }

  @Patch("templates/:templateId")
  async updateTemplate(
    @Param("templateId") templateId: string,
    @Body()
    body: {
      name?: string;
      businessType?: string;
      fieldsConfig?: Array<{ key: string; label: string; placeholder?: string }>;
      sortOrder?: number;
    },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    return this.templatesService.update(templateId, orgId, body);
  }

  @Delete("templates/:templateId")
  async deleteTemplate(
    @Param("templateId") templateId: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    return this.templatesService.delete(templateId, orgId);
  }

  @Patch("default-template")
  async setDefaultTemplate(
    @Body() body: { businessId: string; templateId: string | null },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!body.businessId || !orgId) throw new BadRequestException("businessId required");
    return this.templatesService.setDefaultTemplate(
      body.businessId,
      orgId,
      body.templateId ?? null,
    );
  }

  @Post()
  async create(
    @Body() body: {
      businessId: string;
      name: string;
      mobile?: string;
      email?: string;
      notes?: string;
      preferences?: string;
      tags?: string;
      confirmDuplicate?: boolean;
    },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!body.businessId || !body.name?.trim() || !orgId) {
      throw new BadRequestException("businessId and name required");
    }
    const customer = await this.customersService.create(
      body.businessId,
      orgId,
      {
        name: body.name,
        mobile: body.mobile,
        email: body.email,
        notes: body.notes,
        preferences: body.preferences,
        tags: body.tags,
        confirmDuplicate: body.confirmDuplicate,
      },
    );
    return { customer };
  }

  @Get(":id/message-history")
  async getMessageHistory(
    @Param("id") id: string,
    @Query("limit") limitStr?: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    const events = await this.customersService.getMessageHistory(id, orgId, limit);
    return { events };
  }

  @Get(":id")
  async get(@Param("id") id: string, @Tenant("organizationId") orgId?: string) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    const customer = await this.customersService.findById(id, orgId);
    if (!customer) return { customer: null };
    return { customer };
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() body: { name?: string; mobile?: string; email?: string; notes?: string; preferences?: string; tags?: string },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    const customer = await this.customersService.update(id, orgId, body);
    return { customer };
  }

  @Delete(":id")
  async delete(@Param("id") id: string, @Tenant("organizationId") orgId?: string) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    await this.customersService.delete(id, orgId);
    return { success: true };
  }

  @Post(":id/visit")
  async stampVisit(@Param("id") id: string, @Tenant("organizationId") orgId?: string) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    const customer = await this.customersService.stampVisit(id, orgId);
    return { customer };
  }

  @Patch(":id/visit")
  async adjustVisit(
    @Param("id") id: string,
    @Body() body: { afterCount: number; reason: string },
    @Tenant("organizationId") orgId?: string,
    @Tenant("userId") userId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    if (
      typeof body.afterCount !== "number" ||
      body.afterCount < 0 ||
      !body.reason?.trim()
    ) {
      throw new BadRequestException("afterCount (>= 0) and reason are required");
    }
    const customer = await this.customersService.adjustVisitCount(
      id,
      orgId,
      Math.floor(body.afterCount),
      body.reason.trim(),
      userId,
    );
    return { customer };
  }

  @Get(":id/visit-adjustment-history")
  async getVisitAdjustmentHistory(
    @Param("id") id: string,
    @Query("limit") limitStr?: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    const history = await this.customersService.getVisitAdjustmentHistory(
      id,
      orgId,
      limit,
    );
    return { history };
  }
}
