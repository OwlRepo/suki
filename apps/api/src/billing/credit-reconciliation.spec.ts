import { describe, expect, it } from "vitest";
import {
  applyMonthlyIncludedUpgrade,
  computeCreditLedgerRemaining,
} from "./credit-reconciliation";

describe("credit-reconciliation", () => {
  it("gives a free user who exhausted 5 credits 25 remaining after upgrading to starter", () => {
    const result = applyMonthlyIncludedUpgrade(
      {
        organizationId: "org-1",
        month: "2026-06",
        includedGranted: 5,
        addonGranted: 0,
        used: 5,
        sourcePlan: "free",
      },
      {
        nextPlan: "starter",
        nextIncluded: 30,
      },
    );

    expect(result).toMatchObject({
      includedGranted: 30,
      addonGranted: 0,
      used: 5,
      sourcePlan: "starter",
    });
    expect(computeCreditLedgerRemaining(result)).toBe(25);
  });

  it("gives a partially used free user the correct remaining growth credits", () => {
    const result = applyMonthlyIncludedUpgrade(
      {
        organizationId: "org-1",
        month: "2026-06",
        includedGranted: 5,
        addonGranted: 0,
        used: 2,
        sourcePlan: "free",
      },
      {
        nextPlan: "growth",
        nextIncluded: 80,
      },
    );

    expect(computeCreditLedgerRemaining(result)).toBe(78);
  });

  it("preserves usage during starter to growth upgrades", () => {
    const result = applyMonthlyIncludedUpgrade(
      {
        organizationId: "org-1",
        month: "2026-06",
        includedGranted: 30,
        addonGranted: 0,
        used: 30,
        sourcePlan: "starter",
      },
      {
        nextPlan: "growth",
        nextIncluded: 80,
      },
    );

    expect(result.used).toBe(30);
    expect(computeCreditLedgerRemaining(result)).toBe(50);
  });

  it("preserves purchased top-ups during upgrades", () => {
    const result = applyMonthlyIncludedUpgrade(
      {
        organizationId: "org-1",
        month: "2026-06",
        includedGranted: 5,
        addonGranted: 25,
        used: 12,
        sourcePlan: "free",
      },
      {
        nextPlan: "starter",
        nextIncluded: 30,
      },
    );

    expect(result.addonGranted).toBe(25);
    expect(computeCreditLedgerRemaining(result)).toBe(43);
  });
});
