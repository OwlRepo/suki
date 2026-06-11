import { describe, expect, it } from "vitest";
import {
  assertManualSubscriptionActionAllowed,
  resolveManualCoveragePeriod,
} from "./manual-subscription-policy";

describe("manual-subscription-policy", () => {
  it("starts a first paid period immediately", () => {
    const now = new Date("2026-06-12T04:30:00.000Z");

    expect(
      resolveManualCoveragePeriod({
        now,
        currentAccessEndsAt: null,
        billingInterval: "monthly",
      }),
    ).toEqual({
      startAt: now,
      endAt: new Date("2026-07-12T04:30:00.000Z"),
    });
  });

  it("extends an active paid period from the future access end", () => {
    const currentAccessEndsAt = new Date("2026-07-01T00:00:00.000Z");

    expect(
      resolveManualCoveragePeriod({
        now: new Date("2026-06-12T04:30:00.000Z"),
        currentAccessEndsAt,
        billingInterval: "monthly",
      }),
    ).toEqual({
      startAt: currentAccessEndsAt,
      endAt: new Date("2026-08-01T00:00:00.000Z"),
    });
  });

  it("starts an expired renewal immediately", () => {
    const now = new Date("2026-06-12T04:30:00.000Z");

    expect(
      resolveManualCoveragePeriod({
        now,
        currentAccessEndsAt: new Date("2026-06-01T00:00:00.000Z"),
        billingInterval: "monthly",
      }),
    ).toEqual({
      startAt: now,
      endAt: new Date("2026-07-12T04:30:00.000Z"),
    });
  });

  it("uses UTC-safe monthly advancement at month end", () => {
    expect(
      resolveManualCoveragePeriod({
        now: new Date("2026-01-31T12:00:00.000Z"),
        billingInterval: "monthly",
      }),
    ).toEqual({
      startAt: new Date("2026-01-31T12:00:00.000Z"),
      endAt: new Date("2026-02-28T12:00:00.000Z"),
    });
  });

  it.each([
    ["active_manual", "mark_past_due"],
    ["past_due_manual", "set_grace_until"],
    ["past_due_manual", "suspend"],
    ["active_manual", "suspend"],
    ["suspended", "reactivate"],
    ["active_manual", "cancel"],
    ["past_due_manual", "cancel"],
    ["suspended", "cancel"],
  ] as const)("allows %s -> %s", (status, action) => {
    expect(() =>
      assertManualSubscriptionActionAllowed(status, action),
    ).not.toThrow();
  });

  it.each([
    ["free_active", "mark_past_due"],
    ["active_manual", "reactivate"],
    ["cancelled_manual", "reactivate"],
    ["cancelled_manual", "set_grace_until"],
    ["suspended", "mark_past_due"],
  ] as const)("rejects %s -> %s", (status, action) => {
    expect(() =>
      assertManualSubscriptionActionAllowed(status, action),
    ).toThrow(/not allowed/i);
  });
});
