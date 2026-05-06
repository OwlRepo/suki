import { describe, it, expect, vi } from "vitest";
import { BillingController } from "./billing.controller";

describe("BillingController free mode", () => {
  const billingService = { getPlans: vi.fn().mockReturnValue([]) };
  const orgBillingState = { getOrgBillingState: vi.fn().mockResolvedValue(null) };
  const featureFlags = { founderLedModeEnabled: vi.fn().mockReturnValue(false) };

  it("disables checkout", async () => {
    const controller = new BillingController(
      billingService as never,
      orgBillingState as never,
      featureFlags as never,
    );

    await expect(controller.createCheckout({ planType: "pro" }, "org-1")).resolves.toMatchObject({
      freeMode: true,
      checkoutDisabled: true,
    });
  });

  it("disables dev switch", async () => {
    const controller = new BillingController(
      billingService as never,
      orgBillingState as never,
      featureFlags as never,
    );

    await expect(controller.devSwitchPlan({ planType: "pro" }, "org-1")).resolves.toMatchObject({
      freeMode: true,
      devSwitchDisabled: true,
    });
  });
});
