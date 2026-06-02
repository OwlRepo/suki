import { Injectable } from "@nestjs/common";
import { getDb } from "@tyvera/database";
import { smsCredits, smsUsageEvents } from "@tyvera/database";
import { eq, and, sql } from "drizzle-orm";
import type { PlanType, SmsPausedReason } from "@tyvera/types";
import { PlanCapacityService } from "../common/plan-capacity.service";

/** SMS included per plan per month */
const SMS_INCLUDED_BY_PLAN: Record<PlanType, number> = {
  starter: 300,
  growth: 800,
  pro: 2000,
};

@Injectable()
export class SmsMeteringService {
  constructor(private readonly planCapacity: PlanCapacityService) {}

  private currentMonth(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

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
    const m = month ?? this.currentMonth();
    const plan = await this.planCapacity.getActivePlan(organizationId);
    const included = SMS_INCLUDED_BY_PLAN[plan];

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

    const [created] = await db
      .insert(smsCredits)
      .values({
        organizationId,
        month: m,
        included,
        addon: 0,
        used: 0,
      })
      .returning();

    const total = included;
    return {
      included,
      addon: 0,
      used: 0,
      total,
      remaining: total,
      pausedReason: (created?.pausedReason ?? "none") as SmsPausedReason,
      at80Pct: false,
      at100Pct: false,
    };
  }

  async canConsume(
    organizationId: string,
    units: number = 1,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const credits = await this.getOrCreateCredits(organizationId);
    if (credits.pausedReason !== "none") {
      return {
        allowed: false,
        reason: credits.pausedReason === "cap_reached" ? "sms_cap_reached" : credits.pausedReason,
      };
    }
    if (credits.remaining < units) {
      return { allowed: false, reason: "sms_cap_reached" };
    }
    return { allowed: true };
  }

  async consume(
    organizationId: string,
    businessId: string,
    messageEventId: string,
    units: number = 1,
    costMicros?: number,
  ): Promise<void> {
    const month = this.currentMonth();
    const db = getDb();

    await db
      .update(smsCredits)
      .set({
        used: sql`${smsCredits.used} + ${units}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(smsCredits.organizationId, organizationId),
          eq(smsCredits.month, month),
        ),
      );

    await db.insert(smsUsageEvents).values({
      messageEventId,
      organizationId,
      businessId,
      units,
      status: "consumed",
      costMicros: costMicros ?? null,
    });
  }
}
