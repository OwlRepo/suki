import { Injectable } from "@nestjs/common";
import { getDb } from "@suki/database";
import { smsCredits, smsUsageEvents } from "@suki/database";
import { eq, and, sql } from "drizzle-orm";
import type { PlanType, SmsPausedReason } from "@suki/types";
import { PlanCapacityService } from "../common/plan-capacity.service";
import { SMS_INCLUDED_BY_PLAN } from "../billing/plan-catalog";
import { smsAddonCarryover } from "../billing/addon-carryover";
import { billingMonthKey } from "../common/billing-month";

@Injectable()
export class SmsMeteringService {
  constructor(private readonly planCapacity: PlanCapacityService) {}

  async getOrCreateCredits(
    organizationId: string,
    month?: string,
  ): Promise<{
    included: number;
    addon: number;
    used: number;
    total: number;
    remaining: number;
    pausedReason: SmsPausedReason;
    at80Pct: boolean;
    at100Pct: boolean;
  }> {
    const m = month ?? billingMonthKey();
    const plan = await this.planCapacity.getActivePlan(organizationId);
    const included = SMS_INCLUDED_BY_PLAN[plan] ?? 0;

    const db = getDb();
    const [existing] = await db
      .select()
      .from(smsCredits)
      .where(
        and(
          eq(smsCredits.organizationId, organizationId),
          eq(smsCredits.month, m),
        ),
      )
      .limit(1);

    if (existing) {
      const total = existing.included + existing.addon;
      const remaining = Math.max(0, total - existing.used);
      const pct = total > 0 ? existing.used / total : 0;
      return {
        included: existing.included,
        addon: existing.addon,
        used: existing.used,
        total,
        remaining,
        pausedReason: existing.pausedReason as SmsPausedReason,
        at80Pct: pct >= 0.8,
        at100Pct: remaining <= 0,
      };
    }

    const addon = await smsAddonCarryover(db, organizationId, m);
    const [created] = await db
      .insert(smsCredits)
      .values({
        organizationId,
        month: m,
        included,
        addon,
        used: 0,
      })
      .returning();

    const total = included + addon;
    return {
      included,
      addon,
      used: 0,
      total,
      remaining: total,
      pausedReason: (created?.pausedReason ?? "none") as SmsPausedReason,
      at80Pct: false,
      at100Pct: total <= 0,
    };
  }

  async reserve(
    organizationId: string,
    units: number = 1,
  ): Promise<{ allowed: true; month: string } | { allowed: false; reason: string }> {
    const month = billingMonthKey();
    const credits = await this.getOrCreateCredits(organizationId, month);
    if (credits.pausedReason !== "none") {
      return {
        allowed: false,
        reason: credits.pausedReason === "cap_reached" ? "sms_cap_reached" : credits.pausedReason,
      };
    }
    // Conditional increment so concurrent sends cannot overdraw the month's pool.
    const [reserved] = await getDb()
      .update(smsCredits)
      .set({ used: sql`${smsCredits.used} + ${units}`, updatedAt: new Date() })
      .where(
        and(
          eq(smsCredits.organizationId, organizationId),
          eq(smsCredits.month, month),
          sql`${smsCredits.used} + ${units} <= ${smsCredits.included} + ${smsCredits.addon}`,
        ),
      )
      .returning({ id: smsCredits.id });
    return reserved ? { allowed: true, month } : { allowed: false, reason: "sms_cap_reached" };
  }

  async release(organizationId: string, month: string, units: number = 1): Promise<void> {
    await getDb()
      .update(smsCredits)
      .set({ used: sql`GREATEST(${smsCredits.used} - ${units}, 0)`, updatedAt: new Date() })
      .where(and(eq(smsCredits.organizationId, organizationId), eq(smsCredits.month, month)));
  }

  // Units were already taken by reserve(); this only records the usage event.
  async recordUsage(
    organizationId: string,
    businessId: string,
    messageEventId: string,
    units: number = 1,
    costMicros?: number,
  ): Promise<void> {
    await getDb().insert(smsUsageEvents).values({
      messageEventId,
      organizationId,
      businessId,
      units,
      status: "consumed",
      costMicros: costMicros ?? null,
    });
  }
}
