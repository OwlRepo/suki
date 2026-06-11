import type {
  BillingInterval,
  ManualSubscriptionAction,
  OrgBillingStatus,
  PlanType,
} from "@tyvera/types";

export interface ManualCoverageInput {
  now: Date;
  currentAccessEndsAt?: Date | null;
  billingInterval: Extract<BillingInterval, "monthly">;
}

export function resolveManualCoveragePeriod(input: ManualCoverageInput) {
  const startAt =
    input.currentAccessEndsAt &&
    input.currentAccessEndsAt.getTime() > input.now.getTime()
      ? new Date(input.currentAccessEndsAt)
      : new Date(input.now);

  return {
    startAt,
    endAt: addUtcMonthsClamped(startAt, 1),
  };
}

const ALLOWED_ACTIONS: Partial<
  Record<OrgBillingStatus, ManualSubscriptionAction[]>
> = {
  active_manual: ["mark_past_due", "suspend", "cancel"],
  past_due_manual: ["set_grace_until", "suspend", "cancel"],
  suspended: ["reactivate", "cancel"],
};

export function assertManualSubscriptionActionAllowed(
  currentStatus: OrgBillingStatus | null | undefined,
  action: ManualSubscriptionAction,
): void {
  if (!currentStatus || !ALLOWED_ACTIONS[currentStatus]?.includes(action)) {
    throw new Error(
      `Manual subscription action ${action} is not allowed from ${currentStatus ?? "unknown"}.`,
    );
  }
}

export function isPaidManualPlan(
  planType: PlanType | null | undefined,
): planType is Exclude<PlanType, "free"> {
  return (
    planType === "starter" || planType === "growth" || planType === "pro"
  );
}

function addUtcMonthsClamped(date: Date, months: number) {
  const result = new Date(date);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return result;
}
