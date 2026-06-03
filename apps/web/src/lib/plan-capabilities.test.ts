import { describe, expect, it } from "vitest";
import { getPlanCapabilities } from "./plan-capabilities";

describe("getPlanCapabilities", () => {
  it.each(["free", "starter"] as const)(
    "hides AI surfaces for %s",
    (planType) => {
      const caps = getPlanCapabilities(planType);

      expect(caps.planType).toBe(planType);
      expect(caps.canUseAi).toBe(false);
      expect(caps.canSeeAssistant).toBe(false);
      expect(caps.canSeeAiUsage).toBe(false);
      expect(caps.canSeeAiAnalytics).toBe(false);
      expect(caps.canSeeRefineWithAi).toBe(false);
    },
  );

  it.each(["growth", "pro"] as const)(
    "shows AI surfaces for %s",
    (planType) => {
      const caps = getPlanCapabilities(planType);

      expect(caps.planType).toBe(planType);
      expect(caps.canUseAi).toBe(true);
      expect(caps.canSeeAssistant).toBe(true);
      expect(caps.canSeeAiUsage).toBe(true);
      expect(caps.canSeeAiAnalytics).toBe(true);
      expect(caps.canSeeRefineWithAi).toBe(true);
    },
  );
});
