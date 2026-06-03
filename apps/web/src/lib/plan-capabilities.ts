export type PlanCapabilities = {
  planType: "free" | "starter" | "growth" | "pro";
  canUseAi: boolean;
  canSeeAssistant: boolean;
  canSeeAiUsage: boolean;
  canSeeAiAnalytics: boolean;
  canSeeRefineWithAi: boolean;
};

export function getPlanCapabilities(planType?: string | null): PlanCapabilities {
  const normalizedPlanType =
    planType === "free" || planType === "starter" || planType === "growth" || planType === "pro"
      ? planType
      : "free";
  const canUseAi = normalizedPlanType === "growth" || normalizedPlanType === "pro";

  return {
    planType: normalizedPlanType,
    canUseAi,
    canSeeAssistant: canUseAi,
    canSeeAiUsage: canUseAi,
    canSeeAiAnalytics: canUseAi,
    canSeeRefineWithAi: canUseAi,
  };
}
