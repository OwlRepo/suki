import { Controller, Get, Post, Body, Query, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { Tenant } from "../common/tenant.decorator";
import { CrmModeGuard } from "../common/crm-mode.guard";
import { ActivitiesService } from "./activities.service";

@Controller("crm/activities")
@UseGuards(ClerkAuthGuard, CrmModeGuard)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  async list(
    @Tenant("organizationId") orgId: string,
    @Query("businessId") businessId: string,
    @Query("customerId") customerId?: string,
    @Query("dealId") dealId?: string,
  ) {
    if (!businessId) throw new Error("businessId required");
    const list = await this.activitiesService.list(orgId!, businessId, {
      customerId,
      dealId,
    });
    return { activities: list };
  }

  @Post()
  async create(
    @Tenant("organizationId") orgId: string,
    @Tenant("userId") userId: string,
    @Body() body: {
      businessId: string;
      customerId?: string;
      dealId?: string;
      type: string;
      subject?: string;
      notes?: string;
    },
  ) {
    const activity = await this.activitiesService.create(orgId!, {
      ...body,
      createdByUserId: userId ?? undefined,
    });
    return { activity };
  }
}
