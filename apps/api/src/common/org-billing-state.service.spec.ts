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

  it("keeps a past-due manual tenant writable during an approved grace period", () => {
    const state = service.deriveState({
      trialStartsAt: null,
      trialEndsAt: null,
      billingStatus: "past_due_manual",
      currentPlan: "starter",
      accessEndsAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      nextBillingDueAt: null,
      manualBillingNotes: null,
      subscriptionStatus: "past_due",
      subscriptionEndsAt: null,
      subscriptionRenewsAt: null,
      subscriptionCancelled: false,
      subscriptionGraceUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      subscriptionProvider: "manual",
    });

    expect(state.billingStatus).toBe("past_due_manual");
    expect(state.isReadOnly).toBe(false);
    expect(state.canSendAutomations).toBe(true);
  });

  describe("Lemon Squeezy payment grace", () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const lemonOrg = (overrides: Record<string, unknown>) => ({
      trialStartsAt: null,
      trialEndsAt: null,
      billingStatus: "subscription_past_due",
      currentPlan: "growth",
      accessEndsAt: null,
      nextBillingDueAt: null,
      manualBillingNotes: null,
      subscriptionEndsAt: null,
      subscriptionRenewsAt: null,
      subscriptionCancelled: false,
      subscriptionProvider: "lemonsqueezy",
      ...overrides,
    });

    it("edge: LS past_due inside grace keeps the paid currentPlan and gives includedCreditsPlan free", () => {
      const state = service.deriveState(
        lemonOrg({ subscriptionStatus: "past_due", subscriptionGraceUntil: new Date(Date.now() + 3 * DAY_MS) }),
      );

      expect(state.currentPlan).toBe("growth");
      expect(state.includedCreditsPlan).toBe("free");
      expect(state.billingStatus).toBe("subscription_past_due");
    });

    it("edge: LS unpaid after graceUntil gives free", () => {
      const state = service.deriveState(
        lemonOrg({ subscriptionStatus: "unpaid", subscriptionGraceUntil: new Date(Date.now() - DAY_MS) }),
      );

      expect(state.currentPlan).toBe("free");
      expect(state.includedCreditsPlan).toBe("free");
    });

    it("regression: null graceUntil keeps the paid plan (legacy rows)", () => {
      const state = service.deriveState(lemonOrg({ subscriptionStatus: "past_due", subscriptionGraceUntil: null }));

      expect(state.currentPlan).toBe("growth");
    });

    it("regression: manual grace unchanged", () => {
      const state = service.deriveState(
        lemonOrg({
          billingStatus: "past_due_manual",
          currentPlan: "starter",
          subscriptionStatus: "past_due",
          subscriptionGraceUntil: new Date(Date.now() - DAY_MS),
          subscriptionProvider: "manual",
        }),
      );

      expect(state.currentPlan).toBe("starter");
      expect(state.includedCreditsPlan).toBe("starter");
      expect(state.billingStatus).toBe("past_due_manual");
    });

    it("regression: an active LS subscription keeps includedCreditsPlan equal to currentPlan", () => {
      const state = service.deriveState(
        lemonOrg({ billingStatus: "subscription_active", subscriptionStatus: "active", subscriptionGraceUntil: null }),
      );

      expect(state.includedCreditsPlan).toBe("growth");
    });
  });
});
