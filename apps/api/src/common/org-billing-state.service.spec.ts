import { describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { getDb, organizations } from "@suki/database";
import { OrgBillingStateService } from "./org-billing-state.service";

vi.mock("@suki/database", async () => {
  const actual = await vi.importActual<typeof import("@suki/database")>("@suki/database");
  return { ...actual, getDb: vi.fn() };
});

type SubscriptionFixture = {
  id: string;
  provider: string | null;
  status: string;
  endsAt: Date | null;
  currentPeriodEnd: Date;
};

// Applies the service's orderBy: a liveness-first CASE term (when present) ahead of currentPeriodEnd desc.
function mockDb(org: Record<string, unknown>, subscriptionRows: SubscriptionFixture[]) {
  const dialect = new PgDialect();
  const isLive = (row: SubscriptionFixture) =>
    row.provider === "lemonsqueezy" &&
    (["active", "trialing", "past_due", "unpaid", "paused"].includes(row.status) ||
      (row.status === "cancelled" && !!row.endsAt && row.endsAt.getTime() > Date.now()));
  vi.mocked(getDb).mockReturnValue({
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => (table === organizations ? [org] : []),
          orderBy: (...ordering: unknown[]) => ({
            limit: async () => {
              const liveFirst = ordering.some((term) =>
                dialect.sqlToQuery(term as SQL).sql.toLowerCase().includes("case when"),
              );
              const rank = (row: SubscriptionFixture) => (liveFirst && isLive(row) ? 0 : 1);
              return [...subscriptionRows]
                .sort((a, b) => rank(a) - rank(b) || b.currentPeriodEnd.getTime() - a.currentPeriodEnd.getTime())
                .slice(0, 1);
            },
          }),
        }),
      }),
    }),
  } as never);
}

describe("OrgBillingStateService", () => {
  const service = new OrgBillingStateService();

  it("regression: getOrgBillingState prefers the live LS subscription over an ended one with a later currentPeriodEnd", async () => {
    mockDb(
      {
        id: "org-1",
        trialStartsAt: null,
        trialEndsAt: null,
        billingStatus: "subscription_active",
        currentPlan: "growth",
        accessEndsAt: null,
        nextBillingDueAt: null,
        manualBillingNotes: null,
      },
      [
        {
          id: "ended-a",
          provider: "lemonsqueezy",
          status: "expired",
          endsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          currentPeriodEnd: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000),
        },
        {
          id: "live-b",
          provider: "lemonsqueezy",
          status: "active",
          endsAt: null,
          currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        },
      ],
    );

    const state = await service.getOrgBillingState("org-1");

    expect(state?.billingStatus).toBe("subscription_active");
  });

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
