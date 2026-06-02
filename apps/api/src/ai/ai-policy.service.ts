import { Injectable } from "@nestjs/common";
import { PlanCapacityService } from "../common/plan-capacity.service";
import { AI_QUOTAS } from "./ai-quotas";
import type { PlanType } from "@tyvera/types";

@Injectable()
export class AiPolicyService {
  constructor(private readonly planCapacity: PlanCapacityService) {}

  async checkFeatureAccess(
    organizationId: string,
    _userId: string,
    feature: string,
  ): Promise<void> {
    void organizationId;
    void feature;
  }

  validateInput(
    estimatedPromptTokens: number,
    contextRecordCount: number,
    plan: PlanType,
  ): { valid: boolean; reason?: string } {
    const quota = AI_QUOTAS[plan];
    if (estimatedPromptTokens > quota.maxInputPromptTokens) {
      return { valid: false, reason: "AI_INPUT_TOKEN_LIMIT_EXCEEDED" };
    }
    if (contextRecordCount > quota.maxContextRecords) {
      return { valid: false, reason: "AI_CONTEXT_LIMIT_EXCEEDED" };
    }
    return { valid: true };
  }

  getMaxOutputTokens(plan: PlanType, feature: string): number {
    const quota = AI_QUOTAS[plan];
    return quota.perFeatureMaxOutputTokens[feature] ?? 600;
  }

  getQuota(plan: PlanType) {
    return AI_QUOTAS[plan];
  }
}
