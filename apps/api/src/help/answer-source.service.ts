import { Injectable } from "@nestjs/common";
import { InsightsService } from "../insights/insights.service";
import { SmsMeteringService } from "../messaging/sms-metering.service";
import { BillingService } from "../billing/billing.service";
import { AiUsageService } from "../ai/ai-usage.service";
import type { AnswerSourceResponse } from "./answer-source.types";

@Injectable()
export class AnswerSourceService {
  constructor(
    private readonly insights: InsightsService,
    private readonly smsMetering: SmsMeteringService,
    private readonly billing: BillingService,
    private readonly aiUsage: AiUsageService,
  ) {}

  async getBusinessSummary(input: {
    organizationId: string;
    businessId: string;
    year?: number;
    month?: number;
  }): Promise<AnswerSourceResponse<{ year: number; month: number; newCustomers: number; repeatCustomers: number; repeatVisits: number }>> {
    const now = new Date();
    const year = input.year ?? now.getFullYear();
    const month = input.month ?? now.getMonth() + 1;
    const metrics = await this.insights.getMonthlyMetrics(input.businessId, input.organizationId, year, month);

    if (!metrics) {
      return {
        domain: "business_summary",
        available: false,
        canonical: null,
        humanReadable: "No source data available for this business and month.",
        asOf: new Date().toISOString(),
        businessScope: input.businessId,
      };
    }

    return {
      domain: "business_summary",
      available: true,
      canonical: metrics,
      humanReadable: `For ${metrics.month}/${metrics.year}: ${metrics.newCustomers} new, ${metrics.repeatCustomers} returning, ${metrics.repeatVisits} seen this month.`,
      asOf: new Date().toISOString(),
      businessScope: input.businessId,
    };
  }

  async getSmsUsage(input: { organizationId: string }): Promise<AnswerSourceResponse<{ included: number; addon: number; used: number; total: number; remaining: number; pausedReason: string }>> {
    const usage = await this.smsMetering.getOrCreateCredits(input.organizationId);
    return {
      domain: "sms_usage",
      available: true,
      canonical: {
        included: usage.included,
        addon: usage.addon,
        used: usage.used,
        total: usage.total,
        remaining: usage.remaining,
        pausedReason: usage.pausedReason,
      },
      humanReadable: `${usage.remaining} SMS remaining out of ${usage.total} total credits this month.`,
      asOf: new Date().toISOString(),
      businessScope: null,
    };
  }

  async getBillingStatus(input: { organizationId: string }): Promise<AnswerSourceResponse<{ planType: string; status: string | null; currentPeriodEnd: string | null }>> {
    const sub = await this.billing.getSubscription(input.organizationId);
    return {
      domain: "billing_status",
      available: !!sub,
      canonical: sub
        ? {
            planType: sub.planType,
            status: sub.status,
            currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
          }
        : null,
      humanReadable: sub
        ? `Plan ${sub.planType} is currently ${sub.status}.`
        : "No subscription source record available.",
      asOf: new Date().toISOString(),
      businessScope: null,
    };
  }

  async getAiUsageSummary(input: { organizationId: string }): Promise<AnswerSourceResponse<{ plan: string; month: string; tokensUsed: number; tokensLimit: number; requestsUsed: number; requestsLimit: number }>> {
    const summary = await this.aiUsage.getSummary(input.organizationId);
    return {
      domain: "ai_usage",
      available: true,
      canonical: {
        plan: summary.plan,
        month: summary.month,
        tokensUsed: summary.tokensUsed,
        tokensLimit: summary.tokensLimit,
        requestsUsed: summary.requestsUsed,
        requestsLimit: summary.requestsLimit,
      },
      humanReadable: `AI usage this month: ${summary.tokensUsed}/${summary.tokensLimit} tokens and ${summary.requestsUsed}/${summary.requestsLimit} requests.`,
      asOf: new Date().toISOString(),
      businessScope: null,
    };
  }
}
