import { Controller, Get, Query, UseGuards, UnauthorizedException } from "@nestjs/common";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { Tenant } from "../common/tenant.decorator";
import { AnswerSourceService } from "./answer-source.service";

@Controller("help/answer-source")
@UseGuards(ClerkAuthGuard)
export class AnswerSourceController {
  constructor(private readonly answerSource: AnswerSourceService) {}

  @Get("business-summary")
  async getBusinessSummary(
    @Query("businessId") businessId: string,
    @Query("year") year?: string,
    @Query("month") month?: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    if (!businessId) {
      return {
        domain: "business_summary",
        available: false,
        canonical: null,
        humanReadable: "No source data available for this business.",
        asOf: new Date().toISOString(),
        businessScope: null,
      };
    }

    return this.answerSource.getBusinessSummary({
      organizationId: orgId,
      businessId,
      year: year ? Number.parseInt(year, 10) : undefined,
      month: month ? Number.parseInt(month, 10) : undefined,
    });
  }

  @Get("sms-usage")
  async getSmsUsage(@Tenant("organizationId") orgId?: string) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    return this.answerSource.getSmsUsage({ organizationId: orgId });
  }

  @Get("billing-status")
  async getBillingStatus(@Tenant("organizationId") orgId?: string) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    return this.answerSource.getBillingStatus({ organizationId: orgId });
  }

  @Get("ai-usage")
  async getAiUsage(@Tenant("organizationId") orgId?: string) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    return this.answerSource.getAiUsageSummary({ organizationId: orgId });
  }
}
