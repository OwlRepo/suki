import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { BusinessesService } from "./businesses.service";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { BillingWriteGuard } from "../common/billing-write.guard";
import { Tenant } from "../common/tenant.decorator";
import { FeatureFlagsService } from "../common/feature-flags.service";

@Controller("businesses")
@UseGuards(ClerkAuthGuard, BillingWriteGuard)
export class BusinessesController {
  constructor(
    private readonly businessesService: BusinessesService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  @Get()
  async list(@Tenant("organizationId") orgId: string) {
    const list = await this.businessesService.listByOrganization(orgId);
    return { businesses: list };
  }

  @Post()
  async create(
    @Tenant("organizationId") orgId: string,
    @Body() body: { name: string; businessType: string; workflowProfile?: string },
  ) {
    if (!body.name?.trim() || !body.businessType?.trim()) {
      throw new ForbiddenException("name and businessType are required");
    }
    const business = await this.businessesService.create(orgId, {
      name: body.name.trim(),
      businessType: body.businessType.trim(),
      workflowProfile: body.workflowProfile,
    });
    return { business };
  }

  @Get(":id")
  async get(@Param("id") id: string, @Tenant("organizationId") orgId: string) {
    const business = await this.businessesService.findById(id);
    if (!business || business.organizationId !== orgId) {
      throw new ForbiddenException("Business not found");
    }
    return { business };
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Tenant("organizationId") orgId: string,
    @Body() body: { name?: string; businessType?: string },
  ) {
    const business = await this.businessesService.findById(id);
    if (!business || business.organizationId !== orgId) {
      throw new ForbiddenException("Business not found");
    }
    const updated = await this.businessesService.update(id, body);
    return { business: updated };
  }

  @Patch(":id/crm-mode")
  async updateCrmMode(
    @Param("id") id: string,
    @Tenant("organizationId") orgId: string,
    @Body() body: { crmMode: "lite" | "full" },
  ) {
    if (!this.featureFlags.crmModeToggleEnabled()) {
      throw new ForbiddenException("CRM mode toggle is not enabled");
    }
    if (!body.crmMode || !["lite", "full"].includes(body.crmMode)) {
      throw new ForbiddenException("crmMode must be 'lite' or 'full'");
    }
    const updated = await this.businessesService.updateCrmMode(
      id,
      orgId,
      body.crmMode,
    );
    return { business: updated };
  }
}
