import { Injectable } from "@nestjs/common";
import { getDb } from "@suki/database";
import { subscriptions } from "@suki/database";
import { eq, sql } from "drizzle-orm";
import type { PlanType } from "@suki/types";

export const MODULES_BY_PLAN: Record<PlanType, string[]> = {
  starter: ["crm", "insights", "loyalty"],
  growth: ["crm", "insights", "loyalty", "appointments", "promos"],
  ai_pro: ["crm", "insights", "loyalty", "appointments", "promos", "ai_messaging"],
};

@Injectable()
export class PlanCapacityService {
  async getActivePlan(organizationId: string): Promise<PlanType> {
    const db = getDb();
    const activeStatuses = ["active", "trialing"] as const;
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .orderBy(sql`${subscriptions.currentPeriodEnd} desc`)
      .limit(1);
    if (!sub || !activeStatuses.includes(sub.status as (typeof activeStatuses)[number])) {
      return "starter";
    }
    return sub.planType;
  }

  hasModuleAccess(plan: PlanType, module: string): boolean {
    return MODULES_BY_PLAN[plan]?.includes(module) ?? false;
  }

  async checkModuleAccess(organizationId: string, module: string): Promise<boolean> {
    const plan = await this.getActivePlan(organizationId);
    return this.hasModuleAccess(plan, module);
  }

  /** True when subscription is past_due or cancelled (grace / read-only mode). */
  async isReadOnly(organizationId: string): Promise<boolean> {
    const db = getDb();
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .orderBy(sql`${subscriptions.currentPeriodEnd} desc`)
      .limit(1);
    if (!sub) return false;
    return ["past_due", "cancelled"].includes(sub.status as string);
  }
}
