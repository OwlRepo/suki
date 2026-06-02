import { Injectable } from "@nestjs/common";
import { getDb } from "@tyvera/database";
import { aiUsageEvents, aiBudgets } from "@tyvera/database";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { PlanCapacityService } from "../common/plan-capacity.service";
import { AI_QUOTAS } from "./ai-quotas";

function getCurrentMonthUTC(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function getMonthBoundariesUTC(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return { start, end };
}

function getDayStartUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
}

function getNextDayStartUTC(): Date {
  const start = getDayStartUTC();
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

function getEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

const AI_DAILY_REQUEST_LIMIT_DEFAULT = 150;
const AI_DAILY_TOKEN_LIMIT_DEFAULT = 150_000;

@Injectable()
export class AiUsageService {
  constructor(private readonly planCapacity: PlanCapacityService) {}

  async getSummary(organizationId: string, month?: string) {
    const plan = await this.planCapacity.getActivePlan(organizationId);
    const quota = AI_QUOTAS[plan];
    const targetMonth = month ?? getCurrentMonthUTC();
    const { start: startOfMonth, end: endOfMonth } = getMonthBoundariesUTC(targetMonth);

    const db = getDb();
    const [tokensRow] = await db
      .select({
        totalTokens: sql<number>`coalesce(sum(${aiUsageEvents.totalTokens}), 0)::int`,
        totalRequests: sql<number>`count(*)::int`,
      })
      .from(aiUsageEvents)
      .where(
        and(
          eq(aiUsageEvents.organizationId, organizationId),
          gte(aiUsageEvents.createdAt, startOfMonth),
          lte(aiUsageEvents.createdAt, endOfMonth),
        ),
      );

    const tokensUsed = Number(tokensRow?.totalTokens ?? 0);
    const requestsUsed = Number(tokensRow?.totalRequests ?? 0);

    const [budgetRow] = await db
      .select()
      .from(aiBudgets)
      .where(
        and(
          eq(aiBudgets.organizationId, organizationId),
          eq(aiBudgets.month, targetMonth),
        ),
      )
      .limit(1);

    const tokenLimit = budgetRow?.tokenLimit ?? quota.monthlyTokenLimit;
    const requestLimit = budgetRow?.requestLimit ?? quota.monthlyRequestLimit;
    const aiEnabled = budgetRow?.aiEnabled !== "false";
    const softCapPct = budgetRow?.softCapPct ?? 90;
    const [dailyRow] = await db
      .select({
        dailyTokens: sql<number>`coalesce(sum(${aiUsageEvents.totalTokens}), 0)::int`,
        dailyRequests: sql<number>`count(*)::int`,
      })
      .from(aiUsageEvents)
      .where(
        and(
          eq(aiUsageEvents.organizationId, organizationId),
          gte(aiUsageEvents.createdAt, getDayStartUTC()),
        ),
      );

    const dailyTokensUsed = Number(dailyRow?.dailyTokens ?? 0);
    const dailyRequestsUsed = Number(dailyRow?.dailyRequests ?? 0);
    const dailyTokensLimit = Math.floor(quota.monthlyTokenLimit * (quota.dailyCapPct ?? 0.2));
    const dailyRequestsLimit = getEnvInt("AI_DAILY_REQUEST_LIMIT", AI_DAILY_REQUEST_LIMIT_DEFAULT);

    return {
      plan,
      month: targetMonth,
      tokensUsed,
      tokensLimit: tokenLimit,
      requestsUsed,
      requestsLimit: requestLimit,
      aiEnabled,
      softCapPct,
      allowedFeatures: quota.allowedFeatures,
      resetDate: this.getResetDate(targetMonth),
      dailyTokensUsed,
      dailyTokensLimit,
      dailyTokensRemaining: Math.max(0, dailyTokensLimit - dailyTokensUsed),
      dailyRequestsUsed,
      dailyRequestsLimit,
      dailyRequestsRemaining: Math.max(0, dailyRequestsLimit - dailyRequestsUsed),
      dailyResetDateTime: getNextDayStartUTC().toISOString(),
      projectedDaysToLimit:
        requestsUsed > 0 && requestLimit > 0
          ? Math.floor(
              (getMonthBoundariesUTC(targetMonth).end.getTime() +
                24 * 60 * 60 * 1000 -
                Date.now()) /
                (24 * 60 * 60 * 1000),
            )
          : null,
    };
  }

  async getBreakdown(
    organizationId: string,
    month?: string,
    groupBy: "feature" | "user" | "business" = "feature",
  ) {
    const targetMonth = month ?? getCurrentMonthUTC();
    const { start: startOfMonth, end: endOfMonth } = getMonthBoundariesUTC(targetMonth);
    const db = getDb();

    const groupColumn =
      groupBy === "feature"
        ? aiUsageEvents.feature
        : groupBy === "user"
          ? aiUsageEvents.userId
          : aiUsageEvents.businessId;

    const rows = await db
      .select({
        groupKey: groupColumn,
        totalTokens: sql<number>`sum(${aiUsageEvents.totalTokens})::int`,
        totalRequests: sql<number>`count(*)::int`,
      })
      .from(aiUsageEvents)
      .where(
        and(
          eq(aiUsageEvents.organizationId, organizationId),
          gte(aiUsageEvents.createdAt, startOfMonth),
          lte(aiUsageEvents.createdAt, endOfMonth),
        ),
      )
      .groupBy(groupColumn);

    return {
      month: targetMonth,
      groupBy,
      items: rows.map((r) => ({
        key: r.groupKey ?? "unknown",
        tokens: Number(r.totalTokens ?? 0),
        requests: Number(r.totalRequests ?? 0),
      })),
    };
  }

  async updatePolicies(
    organizationId: string,
    data: {
      month?: string;
      softCapPct?: number;
      aiEnabled?: boolean;
    },
  ) {
    const targetMonth = data.month ?? getCurrentMonthUTC();
    const plan = await this.planCapacity.getActivePlan(organizationId);
    const quota = AI_QUOTAS[plan];

    const db = getDb();
    const [existing] = await db
      .select()
      .from(aiBudgets)
      .where(
        and(
          eq(aiBudgets.organizationId, organizationId),
          eq(aiBudgets.month, targetMonth),
        ),
      )
      .limit(1);

    const updates: {
      softCapPct?: number;
      aiEnabled?: string;
      tokenLimit?: number;
      requestLimit?: number;
      updatedAt?: Date;
    } = {
      updatedAt: new Date(),
    };
    if (data.softCapPct != null) updates.softCapPct = data.softCapPct;
    if (data.aiEnabled != null) updates.aiEnabled = data.aiEnabled ? "true" : "false";

    if (existing) {
      const [updated] = await db
        .update(aiBudgets)
        .set(updates)
        .where(eq(aiBudgets.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(aiBudgets)
      .values({
        organizationId,
        month: targetMonth,
        tokenLimit: quota.monthlyTokenLimit,
        requestLimit: quota.monthlyRequestLimit,
        ...(updates.softCapPct != null && { softCapPct: updates.softCapPct }),
        ...(updates.aiEnabled != null && { aiEnabled: updates.aiEnabled }),
      })
      .returning();
    return created;
  }

  private getResetDate(month: string): string {
    const [y, m] = month.split("-").map(Number);
    const nextMonth = new Date(Date.UTC(y, m, 1));
    return nextMonth.toISOString().slice(0, 10);
  }

  async checkBudget(
    organizationId: string,
    estimatedTokens: number,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const plan = await this.planCapacity.getActivePlan(organizationId);
    const quota = AI_QUOTAS[plan];
    const targetMonth = getCurrentMonthUTC();
    const { start: startOfMonth, end: endOfMonth } = getMonthBoundariesUTC(targetMonth);
    const dayStart = getDayStartUTC();
    const db = getDb();

    const [tokensRow] = await db
      .select({
        totalTokens: sql<number>`coalesce(sum(${aiUsageEvents.totalTokens}), 0)::int`,
        totalRequests: sql<number>`count(*)::int`,
      })
      .from(aiUsageEvents)
      .where(
        and(
          eq(aiUsageEvents.organizationId, organizationId),
          gte(aiUsageEvents.createdAt, startOfMonth),
          lte(aiUsageEvents.createdAt, endOfMonth),
        ),
      );

    const tokensUsed = Number(tokensRow?.totalTokens ?? 0);
    const requestsUsed = Number(tokensRow?.totalRequests ?? 0);

    const [dailyRow] = await db
      .select({
        dailyTokens: sql<number>`coalesce(sum(${aiUsageEvents.totalTokens}), 0)::int`,
        dailyRequests: sql<number>`count(*)::int`,
      })
      .from(aiUsageEvents)
      .where(
        and(
          eq(aiUsageEvents.organizationId, organizationId),
          gte(aiUsageEvents.createdAt, dayStart),
        ),
      );
    const dailyTokens = Number(dailyRow?.dailyTokens ?? 0);
    const dailyRequests = Number(dailyRow?.dailyRequests ?? 0);
    const dailyCap = Math.floor(quota.monthlyTokenLimit * (quota.dailyCapPct ?? 0.08));
    const dailyRequestLimit = getEnvInt("AI_DAILY_REQUEST_LIMIT", AI_DAILY_REQUEST_LIMIT_DEFAULT);
    const dailyTokenLimit = getEnvInt("AI_DAILY_TOKEN_LIMIT", AI_DAILY_TOKEN_LIMIT_DEFAULT);

    if (quota.monthlyTokenLimit > 0 && tokensUsed + estimatedTokens > quota.monthlyTokenLimit) {
      return { allowed: false, reason: "AI_TOKEN_BUDGET_EXCEEDED" };
    }
    if (quota.monthlyRequestLimit > 0 && requestsUsed + 1 > quota.monthlyRequestLimit) {
      return { allowed: false, reason: "AI_TOKEN_BUDGET_EXCEEDED" };
    }
    if (dailyCap > 0 && dailyTokens + estimatedTokens > dailyCap) {
      return { allowed: false, reason: "AI_DAILY_CAP_EXCEEDED" };
    }
    if (dailyRequestLimit > 0 && dailyRequests + 1 > dailyRequestLimit) {
      return { allowed: false, reason: "AI_DAILY_REQUEST_CAP_EXCEEDED" };
    }
    if (dailyTokenLimit > 0 && dailyTokens + estimatedTokens > dailyTokenLimit) {
      return { allowed: false, reason: "AI_DAILY_TOKEN_CAP_EXCEEDED" };
    }

    const [budgetRow] = await db
      .select()
      .from(aiBudgets)
      .where(
        and(
          eq(aiBudgets.organizationId, organizationId),
          eq(aiBudgets.month, targetMonth),
        ),
      )
      .limit(1);
    const aiEnabled = budgetRow?.aiEnabled !== "false";
    if (!aiEnabled) {
      return { allowed: false, reason: "AI_DISABLED" };
    }

    return { allowed: true };
  }

  async recordUsage(
    organizationId: string,
    userId: string | null,
    businessId: string | null,
    feature: string,
    model: string,
    promptTokens: number,
    completionTokens: number,
    totalTokens: number,
  ): Promise<void> {
    const db = getDb();
    await db.insert(aiUsageEvents).values({
      organizationId,
      userId: userId ?? null,
      businessId: businessId ?? null,
      feature,
      model,
      promptTokens,
      completionTokens,
      totalTokens,
      status: "completed",
    });
  }
}
