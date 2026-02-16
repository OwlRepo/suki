import { Injectable } from "@nestjs/common";
import { getDb } from "@suki/database";
import { subscriptions } from "@suki/database";
import { eq, desc } from "drizzle-orm";
import type { PlanType } from "@suki/types";

const PLAN_AMOUNTS: Record<string, number> = {
  starter: 0,
  growth: 499,
  ai_pro: 999,
};

@Injectable()
export class BillingService {
  async getSubscription(organizationId: string) {
    const db = getDb();
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .orderBy(desc(subscriptions.currentPeriodEnd))
      .limit(1);
    return sub ?? null;
  }

  getPlans(): { planType: PlanType; pricePhp: number }[] {
    return [
      { planType: "starter", pricePhp: PLAN_AMOUNTS.starter },
      { planType: "growth", pricePhp: PLAN_AMOUNTS.growth },
      { planType: "ai_pro", pricePhp: PLAN_AMOUNTS.ai_pro },
    ];
  }

  async createOrUpdateSubscriptionFromCheckout(
    organizationId: string,
    planType: PlanType,
    paymongoSessionId?: string,
  ) {
    const db = getDb();
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const [existing] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .orderBy(desc(subscriptions.currentPeriodEnd))
      .limit(1);

    if (existing && ["active", "trialing"].includes(existing.status)) {
      const [updated] = await db
        .update(subscriptions)
        .set({
          planType,
          status: "active",
          paymongoSubscriptionId: paymongoSessionId ?? existing.paymongoSubscriptionId,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, existing.id))
        .returning();
      return updated!;
    }

    const [created] = await db
      .insert(subscriptions)
      .values({
        organizationId,
        planType,
        status: "active",
        paymongoSubscriptionId: paymongoSessionId ?? null,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      })
      .returning();
    return created!;
  }

  async downgradePlan(organizationId: string, planType: PlanType) {
    const db = getDb();
    const [existing] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .orderBy(desc(subscriptions.currentPeriodEnd))
      .limit(1);

    if (!existing) {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      const [created] = await db
        .insert(subscriptions)
        .values({
          organizationId,
          planType,
          status: "active",
          paymongoSubscriptionId: null,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        })
        .returning();
      return created!;
    }

    const now = new Date();
    const [updated] = await db
      .update(subscriptions)
      .set({
        planType,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        updatedAt: now,
      })
      .where(eq(subscriptions.id, existing.id))
      .returning();
    return updated!;
  }
}
