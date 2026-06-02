import type { PlanType } from "@tyvera/types";

export interface CreditLedgerSnapshot {
  organizationId: string;
  month: string;
  includedGranted: number;
  addonGranted: number;
  used: number;
  sourcePlan: PlanType;
}

export function computeCreditLedgerRemaining(ledger: Pick<CreditLedgerSnapshot, "includedGranted" | "addonGranted" | "used">): number {
  return Math.max(0, ledger.includedGranted + ledger.addonGranted - ledger.used);
}

export function applyMonthlyIncludedUpgrade(
  current: CreditLedgerSnapshot,
  input: {
    nextPlan: PlanType;
    nextIncluded: number;
  },
): CreditLedgerSnapshot {
  return {
    ...current,
    includedGranted: Math.max(current.includedGranted, input.nextIncluded),
    sourcePlan: input.nextPlan,
  };
}
