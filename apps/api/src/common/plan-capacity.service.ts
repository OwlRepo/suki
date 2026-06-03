import { Injectable } from "@nestjs/common";
import type { PlanType } from "@tyvera/types";
import { FeatureFlagsService } from "./feature-flags.service";
import { OrgBillingStateService } from "./org-billing-state.service";
import { getPlanCatalogEntry } from "../billing/plan-catalog";

export const MODULES_BY_PLAN: Record<PlanType, string[]> = {
  free: [
    "customers",
    "appointments",
    "booking_page",
    "intake_qr",
    "booking_slot_holds",
    "basic_insights",
  ],
  starter: [
    "customers",
    "appointments",
    "imports",
    "insights",
    "auto_appointment_messaging",
    "auto_missed_recovery",
    "auto_post_visit",
  ],
  growth: [
    "customers",
    "appointments",
    "imports",
    "insights",
    "ai_messaging",
    "auto_appointment_messaging",
    "auto_missed_recovery",
    "auto_post_visit",
    "auto_winback",
  ],
  pro: [
    "customers",
    "appointments",
    "imports",
    "insights",
    "ai_messaging",
    "auto_appointment_messaging",
    "auto_missed_recovery",
    "auto_post_visit",
    "auto_winback",
    "multi_branch",
    "advanced_segmentation",
    "month_to_month_comparison",
  ],
};

export const BUSINESS_LIMITS_BY_PLAN: Record<PlanType, number> = {
  free: 1,
  starter: 1,
  growth: 3,
  pro: 10,
};

@Injectable()
export class PlanCapacityService {
  constructor(
    private readonly featureFlags: FeatureFlagsService,
    private readonly orgBillingState: OrgBillingStateService,
  ) {}

  async getActivePlan(organizationId: string): Promise<PlanType> {
    const state = await this.orgBillingState.getOrgBillingState(organizationId);
    if (state?.currentPlan) {
      return state.currentPlan;
    }
    if (this.featureFlags.founderLedModeEnabled()) {
      return "free";
    }
    return "free";
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
    return BUSINESS_LIMITS_BY_PLAN[plan] ?? getPlanCatalogEntry(plan).limits.branches;
  }

  /** True when subscription is past_due or cancelled (grace / read-only mode). */
  async isReadOnly(organizationId: string): Promise<boolean> {
    const state = await this.orgBillingState.getOrgBillingState(organizationId);
    return state?.isReadOnly ?? false;
  }
}
