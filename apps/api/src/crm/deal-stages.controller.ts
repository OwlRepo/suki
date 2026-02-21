import { Controller, Get, Post, Body, Query, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { Tenant } from "../common/tenant.decorator";
import { CrmModeGuard } from "../common/crm-mode.guard";
import { DealStagesService } from "./deal-stages.service";

@Controller("crm/deal-stages")
@UseGuards(ClerkAuthGuard, CrmModeGuard)
export class DealStagesController {
  constructor(private readonly dealStagesService: DealStagesService) {}

  @Get()
  async list(
    @Tenant("organizationId") orgId: string,
    @Query("businessId") businessId: string,
  ) {
    if (!businessId) throw new Error("businessId required");
    const list = await this.dealStagesService.list(businessId, orgId!);
    return { dealStages: list };
  }

  @Post()
  async create(
    @Tenant("organizationId") orgId: string,
    @Body() body: { businessId: string; name: string; sortOrder?: number },
  ) {
    const stage = await this.dealStagesService.create(orgId!, body);
    return { dealStage: stage };
  }

  @Post("ensure-defaults")
  async ensureDefaults(
    @Tenant("organizationId") orgId: string,
    @Body() body: { businessId: string },
  ) {
    if (!body.businessId) throw new Error("businessId required");
    const list = await this.dealStagesService.ensureDefaults(body.businessId, orgId!);
    return { dealStages: list };
  }
}
