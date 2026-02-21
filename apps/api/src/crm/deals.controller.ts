import { Controller, Get, Post, Patch, Body, Query, Param, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { Tenant } from "../common/tenant.decorator";
import { CrmModeGuard } from "../common/crm-mode.guard";
import { DealsService } from "./deals.service";

@Controller("crm/deals")
@UseGuards(ClerkAuthGuard, CrmModeGuard)
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Get()
  async list(
    @Tenant("organizationId") orgId: string,
    @Query("businessId") businessId: string,
  ) {
    if (!businessId) throw new Error("businessId required");
    const list = await this.dealsService.list(businessId, orgId);
    return { deals: list };
  }

  @Patch(":id/stage")
  async updateStage(
    @Tenant("organizationId") orgId: string,
    @Param("id") id: string,
    @Body() body: { businessId: string; stage: string },
  ) {
    if (!body.businessId || !body.stage) throw new Error("businessId and stage required");
    const deal = await this.dealsService.updateStage(id, orgId, body.stage, body.businessId);
    return { deal };
  }

  @Post()
  async create(
    @Tenant("organizationId") orgId: string,
    @Tenant("userId") userId: string,
    @Body() body: {
      businessId: string;
      customerId?: string;
      title: string;
      stage: string;
      amount?: number;
    },
  ) {
    const deal = await this.dealsService.create(orgId, {
      ...body,
      ownerUserId: userId ?? undefined,
    });
    return { deal };
  }
}
