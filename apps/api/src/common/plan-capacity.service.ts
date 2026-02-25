import { Injectable } from "@nestjs/common";
import { getDb } from "@suki/database";
import { subscriptions } from "@suki/database";
import { eq, sql } from "drizzle-orm";
import type { PlanType } from "@suki/types";
import { FeatureFlagsService } from "./feature-flags.service";
import { OrgBillingStateService } from "./org-billing-state.service";

export const MODULES_BY_PLAN: Record<PlanType, string[]> = {
  starter: ["crm", "insights", "loyalty"],
  growth: [
    "crm",
    "insights",
    "loyalty",
    "appointments",
    "promos",
    "auto_appointment_messaging",
  ],
  ai_pro: [
    "crm",
    "insights",
    "loyalty",
    "appointments",
    "promos",
    "ai_messaging",
    "auto_appointment_messaging",
    "auto_missed_recovery",
    "auto_post_visit",
    "auto_winback",
    "auto_loyalty_unlock",
  ],
};

export const BUSINESS_LIMITS_BY_PLAN: Record<PlanType, number> = {
  starter: 1,
  growth: 5,
  ai_pro: Number.POSITIVE_INFINITY,
};

@Injectable()
export class PlanCapacityService {
  constructor(
    private readonly featureFlags: FeatureFlagsService,
    private readonly orgBillingState: OrgBillingStateService,
  ) {}

  async getActivePlan(organizationId: string): Promise<PlanType> {
    if (this.featureFlags.founderLedModeEnabled()) {
      const state = await this.orgBillingState.getOrgBillingState(organizationId);
      return state?.currentPlan ?? "starter";
    }
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

  async getBusinessLimitByOrg(organizationId: string): Promise<number> {
    const plan = await this.getActivePlan(organizationId);
    return BUSINESS_LIMITS_BY_PLAN[plan];
  }

  /** True when subscription is past_due or cancelled (grace / read-only mode). */
  async isReadOnly(organizationId: string): Promise<boolean> {
    if (this.featureFlags.founderLedModeEnabled()) {
      const state = await this.orgBillingState.getOrgBillingState(organizationId);
      return state?.isReadOnly ?? false;
    }
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
