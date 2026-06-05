import { Injectable } from "@nestjs/common";
import { getDb } from "@tyvera/database";
import {
  customers,
  businesses,
  appointments,
  aiUsageEvents,
  messageEvents,
} from "@tyvera/database";
import { eq, and, gte, lte, sql } from "drizzle-orm";

@Injectable()
export class InsightsService {
  async getMonthlyMetrics(
    businessId: string,
    organizationId: string,
    year: number,
    month: number,
  ) {
    const db = getDb();
    const [biz] = await db
      .select()
      .from(businesses)
      .where(
        and(
          eq(businesses.id, businessId),
          eq(businesses.organizationId, organizationId),
        ),
      )
      .limit(1);
    if (!biz) return null;

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const [newCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(
        and(
          eq(customers.businessId, businessId),
          gte(customers.createdAt, start),
          lte(customers.createdAt, end),
        ),
      );

    const [repeatCustomersResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(
        and(
          eq(customers.businessId, businessId),
          gte(customers.lastVisitAt, start),
          lte(customers.lastVisitAt, end),
          gte(customers.visitCount, 2),
        ),
      );

    const [completedVisitsThisMonth] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(appointments)
      .where(
        and(
          eq(appointments.businessId, businessId),
          eq(appointments.status, "completed"),
          gte(appointments.completedAt, start),
          lte(appointments.completedAt, end),
        ),
      );

    return {
      year,
      month,
      newCustomers: newCount?.count ?? 0,
      repeatCustomers: repeatCustomersResult?.count ?? 0,
      repeatVisits: completedVisitsThisMonth?.count ?? 0,
    };
  }

  async getMonitoringMetrics(
    organizationId: string,
    options?: { businessId?: string; days?: number },
  ) {
    const db = getDb();
    const days = options?.days ?? 30;
    const businessId = options?.businessId?.trim() || undefined;

    const start = new Date();
    start.setUTCDate(start.getUTCDate() - (days - 1));
    start.setUTCHours(0, 0, 0, 0);

    const aiWhere = [
      eq(aiUsageEvents.organizationId, organizationId),
      gte(aiUsageEvents.createdAt, start),
      ...(businessId ? [eq(aiUsageEvents.businessId, businessId)] : []),
    ];

    const automationWhere = [
      eq(businesses.organizationId, organizationId),
      gte(messageEvents.createdAt, start),
      ...(businessId ? [eq(messageEvents.businessId, businessId)] : []),
    ];

    const [
      aiDaily,
      aiFeature,
      aiTopUsers,
      aiTopBusinesses,
      automationDaily,
      automationStatus,
      automationChannel,
      automationKey,
    ] = await Promise.all([
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${aiUsageEvents.createdAt}), 'YYYY-MM-DD')`,
          tokens: sql<number>`coalesce(sum(${aiUsageEvents.totalTokens}), 0)::int`,
          requests: sql<number>`count(*)::int`,
        })
        .from(aiUsageEvents)
        .where(and(...aiWhere))
        .groupBy(sql`date_trunc('day', ${aiUsageEvents.createdAt})`)
        .orderBy(sql`date_trunc('day', ${aiUsageEvents.createdAt}) asc`),
      db
        .select({
          key: aiUsageEvents.feature,
          tokens: sql<number>`coalesce(sum(${aiUsageEvents.totalTokens}), 0)::int`,
          requests: sql<number>`count(*)::int`,
        })
        .from(aiUsageEvents)
        .where(and(...aiWhere))
        .groupBy(aiUsageEvents.feature)
        .orderBy(sql`coalesce(sum(${aiUsageEvents.totalTokens}), 0) desc`)
        .limit(8),
      db
        .select({
          key: aiUsageEvents.userId,
          tokens: sql<number>`coalesce(sum(${aiUsageEvents.totalTokens}), 0)::int`,
          requests: sql<number>`count(*)::int`,
        })
        .from(aiUsageEvents)
        .where(and(...aiWhere))
        .groupBy(aiUsageEvents.userId)
        .orderBy(sql`coalesce(sum(${aiUsageEvents.totalTokens}), 0) desc`)
        .limit(5),
      db
        .select({
          key: aiUsageEvents.businessId,
          tokens: sql<number>`coalesce(sum(${aiUsageEvents.totalTokens}), 0)::int`,
          requests: sql<number>`count(*)::int`,
        })
        .from(aiUsageEvents)
        .where(and(...aiWhere))
        .groupBy(aiUsageEvents.businessId)
        .orderBy(sql`coalesce(sum(${aiUsageEvents.totalTokens}), 0) desc`)
        .limit(5),
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${messageEvents.createdAt}), 'YYYY-MM-DD')`,
          total: sql<number>`count(*)::int`,
          sent: sql<number>`sum(case when ${messageEvents.status} = 'sent' then 1 else 0 end)::int`,
          failed: sql<number>`sum(case when ${messageEvents.status} = 'failed' then 1 else 0 end)::int`,
          skipped: sql<number>`sum(case when ${messageEvents.status} = 'skipped' then 1 else 0 end)::int`,
        })
        .from(messageEvents)
        .innerJoin(businesses, eq(messageEvents.businessId, businesses.id))
        .where(and(...automationWhere))
        .groupBy(sql`date_trunc('day', ${messageEvents.createdAt})`)
        .orderBy(sql`date_trunc('day', ${messageEvents.createdAt}) asc`),
      db
        .select({
          key: messageEvents.status,
          value: sql<number>`count(*)::int`,
        })
        .from(messageEvents)
        .innerJoin(businesses, eq(messageEvents.businessId, businesses.id))
        .where(and(...automationWhere))
        .groupBy(messageEvents.status),
      db
        .select({
          key: messageEvents.channel,
          value: sql<number>`count(*)::int`,
        })
        .from(messageEvents)
        .innerJoin(businesses, eq(messageEvents.businessId, businesses.id))
        .where(and(...automationWhere))
        .groupBy(messageEvents.channel),
      db
        .select({
          key: messageEvents.automationKey,
          value: sql<number>`count(*)::int`,
        })
        .from(messageEvents)
        .innerJoin(businesses, eq(messageEvents.businessId, businesses.id))
        .where(and(...automationWhere))
        .groupBy(messageEvents.automationKey)
        .orderBy(sql`count(*) desc`)
        .limit(8),
    ]);

    return {
      windowDays: days,
      startDate: start.toISOString().slice(0, 10),
      ai: {
        daily: aiDaily.map((row) => ({
          day: row.day,
          tokens: Number(row.tokens ?? 0),
          requests: Number(row.requests ?? 0),
        })),
        featureBreakdown: aiFeature.map((row) => ({
          key: row.key ?? "unknown",
          tokens: Number(row.tokens ?? 0),
          requests: Number(row.requests ?? 0),
        })),
        topUsers: aiTopUsers.map((row) => ({
          key: row.key ?? "unknown",
          tokens: Number(row.tokens ?? 0),
          requests: Number(row.requests ?? 0),
        })),
        topBusinesses: aiTopBusinesses.map((row) => ({
          key: row.key ?? "unknown",
          tokens: Number(row.tokens ?? 0),
          requests: Number(row.requests ?? 0),
        })),
      },
      automation: {
        daily: automationDaily.map((row) => ({
          day: row.day,
          total: Number(row.total ?? 0),
          sent: Number(row.sent ?? 0),
          failed: Number(row.failed ?? 0),
          skipped: Number(row.skipped ?? 0),
        })),
        statusBreakdown: automationStatus.map((row) => ({
          key: row.key ?? "unknown",
          value: Number(row.value ?? 0),
        })),
        channelBreakdown: automationChannel.map((row) => ({
          key: row.key ?? "unknown",
          value: Number(row.value ?? 0),
        })),
        keyBreakdown: automationKey.map((row) => ({
          key: row.key ?? "unknown",
          value: Number(row.value ?? 0),
        })),
      },
    };
  }
}
