import { Injectable } from "@nestjs/common";
import { getDb } from "@tyvera/database";
import { emailCredits, emailUsageEvents } from "@tyvera/database";
import { eq, and, sql } from "drizzle-orm";
import { PlanCapacityService } from "../common/plan-capacity.service";
import { getPlanCatalogEntry } from "../billing/plan-catalog";

@Injectable()
export class EmailMeteringService {
  constructor(private readonly planCapacity: PlanCapacityService) {}

  private currentMonth(): string {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  async getOrCreateCredits(
    organizationId: string,
    month?: string,
  ): Promise<{
    included: number;
    used: number;
    total: number;
    remaining: number;
    at80Pct: boolean;
    at100Pct: boolean;
  }> {
    const m = month ?? this.currentMonth();
    const plan = await this.planCapacity.getActivePlan(organizationId);
    const includedForPlan = getPlanCatalogEntry(plan).limits.emailMessagesPerMonth;
    const db = getDb();
    const [existing] = await db
      .select()
      .from(emailCredits)
      .where(
        and(
          eq(emailCredits.organizationId, organizationId),
          eq(emailCredits.month, m),
        ),
      )
      .limit(1);

    if (existing) {
      const total = existing.included;
      const remaining = Math.max(0, total - existing.used);
      const pct = total > 0 ? existing.used / total : 0;
      return {
        included: existing.included,
        used: existing.used,
        total,
        remaining,
        at80Pct: pct >= 0.8,
        at100Pct: remaining <= 0,
      };
    }

    const [created] = await db
      .insert(emailCredits)
      .values({
        organizationId,
        month: m,
        included: includedForPlan,
        used: 0,
      })
      .returning();

    return {
      included: created?.included ?? includedForPlan,
      used: created?.used ?? 0,
      total: created?.included ?? includedForPlan,
      remaining: created?.included ?? includedForPlan,
      at80Pct: false,
      at100Pct: false,
    };
  }

  async canConsume(
    organizationId: string,
    units: number = 1,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const credits = await this.getOrCreateCredits(organizationId);
    if (credits.remaining < units) return { allowed: false, reason: "email_cap_reached" };
    return { allowed: true };
  }

  async consume(
    organizationId: string,
    businessId: string,
    messageEventId: string,
    units: number = 1,
  ): Promise<void> {
    const month = this.currentMonth();
    const db = getDb();
    await db
      .update(emailCredits)
      .set({
        used: sql`${emailCredits.used} + ${units}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(emailCredits.organizationId, organizationId),
          eq(emailCredits.month, month),
        ),
      );

    await db.insert(emailUsageEvents).values({
      messageEventId,
      organizationId,
      businessId,
      units,
      status: "consumed",
    });
  }
}
