import { Controller, Get, Post, Patch, Body, Query, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { Tenant } from "../common/tenant.decorator";
import { AiService } from "./ai.service";
import { AiUsageService } from "./ai-usage.service";

@Controller("ai")
@UseGuards(ClerkAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiUsageService: AiUsageService,
  ) {}

  @Post("check")
  async check(
    @Tenant("organizationId") orgId: string,
    @Tenant("userId") userId: string,
    @Body() body: {
      feature: string;
      payload?: unknown;
      businessId?: string;
      estimatedPromptTokens?: number;
      contextRecordCount?: number;
    },
  ) {
    return this.aiService.checkAndExecute(
      orgId!,
      userId!,
      body.feature,
      body.payload,
      {
        businessId: body.businessId,
        estimatedPromptTokens: body.estimatedPromptTokens,
        contextRecordCount: body.contextRecordCount,
      },
    );
  }

  @Get("usage/summary")
  async usageSummary(
    @Tenant("organizationId") orgId: string,
    @Query("month") month?: string,
  ) {
    return this.aiUsageService.getSummary(orgId!, month);
  }

  @Get("usage/breakdown")
  async usageBreakdown(
    @Tenant("organizationId") orgId: string,
    @Query("month") month?: string,
    @Query("groupBy") groupBy?: "feature" | "user" | "business",
  ) {
    return this.aiUsageService.getBreakdown(
      orgId!,
      month,
      groupBy ?? "feature",
    );
  }

  @Patch("usage/policies")
  async usagePolicies(
    @Tenant("organizationId") orgId: string,
    @Body() body: { month?: string; softCapPct?: number; aiEnabled?: boolean },
  ) {
    return this.aiUsageService.updatePolicies(orgId!, body);
  }
}
