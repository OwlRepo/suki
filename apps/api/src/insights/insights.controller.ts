import { Controller, Get, Query, UseGuards, BadRequestException } from "@nestjs/common";
import { InsightsService } from "./insights.service";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { Tenant } from "../common/tenant.decorator";

@Controller("insights")
@UseGuards(ClerkAuthGuard)
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get("monthly")
  async getMonthly(
    @Query("businessId") businessId: string,
    @Query("year") yearStr?: string,
    @Query("month") monthStr?: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!businessId || !orgId) throw new BadRequestException("businessId required");
    const now = new Date();
    const year = yearStr ? parseInt(yearStr, 10) : now.getFullYear();
    const month = monthStr ? parseInt(monthStr, 10) : now.getMonth() + 1;
    const metrics = await this.insightsService.getMonthlyMetrics(
      businessId,
      orgId,
      year,
      month,
    );
    return { metrics };
  }

  @Get("monitoring")
  async getMonitoring(
    @Tenant("organizationId") orgId?: string,
    @Query("businessId") businessId?: string,
    @Query("days") daysStr?: string,
  ) {
    if (!orgId) throw new BadRequestException("organization required");
    const parsedDays = daysStr ? parseInt(daysStr, 10) : 30;
    const days = Number.isFinite(parsedDays)
      ? Math.min(Math.max(parsedDays, 7), 90)
      : 30;
    return this.insightsService.getMonitoringMetrics(orgId, { businessId, days });
  }
}
