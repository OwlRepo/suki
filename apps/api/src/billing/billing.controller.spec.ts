import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { BillingController } from "./billing.controller";

describe("BillingController", () => {
  const billingService = {
    getPlansResponse: vi.fn().mockReturnValue({
      checkoutEnabled: false,
      annualCheckoutEnabled: false,
      plans: [{ planType: "free", monthlyPricePhp: 0 }],
    }),
    getBillingStatus: vi.fn().mockResolvedValue({
      planType: "free",
      billingStatus: "free_active",
      subscription: null,
    }),
    createSubscriptionCheckout: vi.fn().mockResolvedValue({
      checkoutUrl: "https://checkout.example/subscription",
    }),
    createAddonCheckout: vi.fn().mockResolvedValue({
      checkoutUrl: "https://checkout.example/addon",
    }),
    changePlan: vi.fn().mockResolvedValue({
      scheduled: true,
      pendingWebhookSync: true,
    }),
    cancel: vi.fn().mockResolvedValue({
      cancellationScheduled: true,
      pendingWebhookSync: true,
    }),
    resume: vi.fn().mockResolvedValue({
      resumed: true,
      pendingWebhookSync: true,
    }),
  };

  const featureFlags = {
    founderLedModeEnabled: vi.fn().mockReturnValue(false),
    selfServeBillingEnabled: vi.fn().mockReturnValue(false),
    annualBillingCheckoutEnabled: vi.fn().mockReturnValue(false),
  };

  const controller = new BillingController(
    billingService as never,
    featureFlags as never,
  );

  it("returns the billing plans response", async () => {
    await expect(controller.getPlans()).resolves.toEqual({
      checkoutEnabled: false,
      annualCheckoutEnabled: false,
      plans: [{ planType: "free", monthlyPricePhp: 0 }],
    });
  });

  it("returns billing status for the current org", async () => {
    await expect(controller.getStatus("org-1", "owner")).resolves.toMatchObject({
      planType: "free",
      billingStatus: "free_active",
      readOnly: false,
    });
    expect(billingService.getBillingStatus).toHaveBeenCalledWith("org-1");
  });

  it("marks staff billing status responses as read-only", async () => {
    await expect(controller.getStatus("org-1", "staff")).resolves.toMatchObject({
      planType: "free",
      readOnly: true,
    });
  });

  it("creates a subscription checkout session", async () => {
    await expect(
      controller.createCheckout(
        { planType: "growth", billingInterval: "monthly" },
        "org-1",
        "user-1",
      ),
    ).resolves.toEqual({
      checkoutUrl: "https://checkout.example/subscription",
    });
  });

  it("creates an add-on checkout session", async () => {
    await expect(
      controller.createAddonCheckout(
        { sku: "sms-segment-topup-25" },
        "org-1",
        "user-1",
      ),
    ).resolves.toEqual({
      checkoutUrl: "https://checkout.example/addon",
    });
  });

  it("requires an authenticated organization for status and checkout", async () => {
    await expect(controller.getStatus(undefined, "owner")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      controller.createCheckout(
        { planType: "starter", billingInterval: "monthly" },
        undefined,
        "user-1",
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("forwards owner plan mutation calls to the billing service", async () => {
    await expect(
      controller.changePlan(
        { planType: "growth", billingInterval: "monthly" },
        "org-1",
      ),
    ).resolves.toMatchObject({
      pendingWebhookSync: true,
    });

    await expect(controller.cancel("org-1")).resolves.toMatchObject({
      cancellationScheduled: true,
    });

    await expect(controller.resume("org-1")).resolves.toMatchObject({
      resumed: true,
    });
  });
});
