import { describe, expect, it } from "vitest";
import { OrgBillingStateService } from "./org-billing-state.service";

describe("OrgBillingStateService", () => {
  const service = new OrgBillingStateService();

  it("defaults missing organizations to free_active and free plan semantics", () => {
    const state = service.deriveState({
      trialStartsAt: null,
      trialEndsAt: null,
      billingStatus: null,
      currentPlan: null,
      accessEndsAt: null,
      nextBillingDueAt: null,
      manualBillingNotes: null,
      subscriptionStatus: null,
      subscriptionEndsAt: null,
      subscriptionRenewsAt: null,
      subscriptionCancelled: null,
    });

    expect(state.billingStatus).toBe("free_active");
    expect(state.currentPlan).toBe("free");
    expect(state.isReadOnly).toBe(false);
    expect(state.canSendAutomations).toBe(true);
  });

  it("maps active paid subscriptions into subscription_active", () => {
    const state = service.deriveState({
      trialStartsAt: null,
      trialEndsAt: null,
      billingStatus: null,
      currentPlan: "growth",
      accessEndsAt: null,
      nextBillingDueAt: null,
      manualBillingNotes: null,
      subscriptionStatus: "active",
      subscriptionEndsAt: null,
      subscriptionRenewsAt: new Date("2026-07-01T00:00:00.000Z"),
      subscriptionCancelled: false,
    });

    expect(state.billingStatus).toBe("subscription_active");
    expect(state.currentPlan).toBe("growth");
    expect(state.isReadOnly).toBe(false);
  });

  it("maps past due subscriptions into a variable-cost blocked state without full read-only", () => {
    const state = service.deriveState({
      trialStartsAt: null,
      trialEndsAt: null,
      billingStatus: null,
      currentPlan: "pro",
      accessEndsAt: null,
      nextBillingDueAt: null,
      manualBillingNotes: null,
      subscriptionStatus: "past_due",
      subscriptionEndsAt: null,
      subscriptionRenewsAt: new Date("2026-07-01T00:00:00.000Z"),
      subscriptionCancelled: false,
    });

    expect(state.billingStatus).toBe("subscription_past_due");
    expect(state.isReadOnly).toBe(false);
    expect(state.variableCostActionsBlocked).toBe(true);
  });

  it("keeps cancellation pending active until ends_at", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const state = service.deriveState({
      trialStartsAt: null,
      trialEndsAt: null,
      billingStatus: null,
      currentPlan: "starter",
      accessEndsAt: null,
      nextBillingDueAt: null,
      manualBillingNotes: null,
      subscriptionStatus: "cancelled",
      subscriptionEndsAt: future,
      subscriptionRenewsAt: future,
      subscriptionCancelled: true,
    });

    expect(state.billingStatus).toBe("subscription_cancelled");
    expect(state.isReadOnly).toBe(false);
  });
});
