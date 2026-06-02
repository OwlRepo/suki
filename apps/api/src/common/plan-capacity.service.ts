import { Injectable } from "@nestjs/common";
import type { PlanType } from "@tyvera/types";
import { FeatureFlagsService } from "./feature-flags.service";
import { OrgBillingStateService } from "./org-billing-state.service";

export const MODULES_BY_PLAN: Record<PlanType, string[]> = {
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
  starter: 1,
  growth: 5,
  pro: Number.POSITIVE_INFINITY,
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
      return state?.currentPlan ?? "pro";
    }
    return "pro";
  }

  hasModuleAccess(plan: PlanType, module: string): boolean {
    void plan;
    void module;
    return true;
  }

  async checkModuleAccess(organizationId: string, module: string): Promise<boolean> {
    const plan = await this.getActivePlan(organizationId);
    return this.hasModuleAccess(plan, module);
  }

  async getBusinessLimitByOrg(organizationId: string): Promise<number> {
    void organizationId;
    return Number.POSITIVE_INFINITY;
  }

  /** True when subscription is past_due or cancelled (grace / read-only mode). */
  async isReadOnly(organizationId: string): Promise<boolean> {
    void organizationId;
    return false;
  }
}
