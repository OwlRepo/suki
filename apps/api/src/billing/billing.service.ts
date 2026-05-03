import { Injectable } from "@nestjs/common";
import { getDb } from "@suki/database";
import { subscriptions, processedWebhookEvents, smsCredits, smsAddons } from "@suki/database";
import { eq, desc, and } from "drizzle-orm";
import type { PlanType } from "@suki/types";

const GRACE_DAYS = 7;

/** Locked pricing: Starter=299, Growth=799, Pro=1499 (PHP/month) */
const PLAN_AMOUNTS: Record<string, number> = {
  starter: 299,
  growth: 799,
  pro: 1499,
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
      { planType: "pro", pricePhp: PLAN_AMOUNTS.pro },
    ];
  }

  async createOrUpdateSubscriptionFromCheckout(
    organizationId: string,
    planType: PlanType,
    paymongoSessionId?: string,
    _eventId?: string,
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

    const planPricePhp = PLAN_AMOUNTS[planType] ?? 0;
    if (existing && ["active", "trialing"].includes(existing.status)) {
      const [updated] = await db
        .update(subscriptions)
        .set({
          planType,
          status: "active",
          paymongoSubscriptionId: paymongoSessionId ?? existing.paymongoSubscriptionId,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          planPricePhp,
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
        planPricePhp,
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

    const planPricePhp = PLAN_AMOUNTS[planType] ?? 0;
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
          planPricePhp,
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
        planPricePhp,
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        updatedAt: now,
      })
      .where(eq(subscriptions.id, existing.id))
      .returning();
    return updated!;
  }

  async isWebhookEventProcessed(eventId: string): Promise<boolean> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(processedWebhookEvents)
      .where(eq(processedWebhookEvents.eventId, eventId))
      .limit(1);
    return !!row;
  }

  async recordWebhookEventId(eventId: string): Promise<void> {
    const db = getDb();
    try {
      await db.insert(processedWebhookEvents).values({ eventId });
    } catch {
      // Ignore duplicate (unique constraint)
    }
  }

  async markSubscriptionPastDue(organizationId: string, _eventId?: string): Promise<void> {
    const db = getDb();
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .orderBy(desc(subscriptions.currentPeriodEnd))
      .limit(1);
    if (!sub) return;
    const graceUntil = new Date();
    graceUntil.setDate(graceUntil.getDate() + GRACE_DAYS);
    await db
      .update(subscriptions)
      .set({
        status: "past_due",
        billingFailureCount: (sub.billingFailureCount ?? 0) + 1,
        graceUntil,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, sub.id));
  }

  async cancelSubscription(organizationId: string, _eventId?: string): Promise<void> {
    const db = getDb();
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .orderBy(desc(subscriptions.currentPeriodEnd))
      .limit(1);
    if (!sub) return;
    await db
      .update(subscriptions)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(subscriptions.id, sub.id));
  }

  async creditSmsAddonFromPayment(organizationId: string): Promise<void> {
    const db = getDb();
    const PACK_SIZE = 300;
    const PACK_PRICE_PHP = 300;
    await db.insert(smsAddons).values({
      organizationId,
      packSize: PACK_SIZE,
      packPricePhp: PACK_PRICE_PHP,
    });

    const month = this.currentMonth();
    const [credits] = await db
      .select()
      .from(smsCredits)
      .where(
        and(
          eq(smsCredits.organizationId, organizationId),
          eq(smsCredits.month, month),
        ),
      )
      .limit(1);
    if (credits) {
      await db
        .update(smsCredits)
        .set({ addon: credits.addon + PACK_SIZE, updatedAt: new Date() })
        .where(eq(smsCredits.id, credits.id));
    } else {
      await db.insert(smsCredits).values({
        organizationId,
        month,
        included: 0,
        addon: PACK_SIZE,
        used: 0,
      });
    }
  }

  private currentMonth(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }
}
