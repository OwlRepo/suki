"use client";

import { StatusBanner } from "@/components/ui/status-banner";

export function BillingStatusBanner({
  billingStatus,
  cancellationPending = false,
  scheduledPlanType,
  scheduledChangeEffectiveAt,
}: {
  billingStatus: string;
  cancellationPending?: boolean;
  scheduledPlanType?: string | null;
  scheduledChangeEffectiveAt?: string | null;
}) {
  if (billingStatus === "subscription_past_due") {
    return (
      <StatusBanner
        variant="warning"
        message="Your account is past due. New variable-cost actions are temporarily blocked until payment is recovered."
      />
    );
  }

  if (billingStatus === "subscription_paused") {
    return (
      <StatusBanner
        variant="warning"
        message="Your subscription is temporarily paused. New variable-cost actions stay blocked until billing resumes."
      />
    );
  }

  if (billingStatus === "subscription_cancelled") {
    return (
      <StatusBanner
        variant="info"
        message="Cancellation is scheduled. Your current access stays active until the end of the billing period."
      />
    );
  }

  if (cancellationPending) {
    return (
      <StatusBanner
        variant="info"
        message="Cancellation is pending. Your current access stays active until the end of the billing period."
      />
    );
  }

  if (scheduledPlanType) {
    const effectiveLabel = scheduledChangeEffectiveAt
      ? ` on ${new Date(scheduledChangeEffectiveAt).toLocaleDateString("en-PH")}`
      : "";
    return (
      <StatusBanner
        variant="info"
        message={`Your plan is scheduled to move to ${scheduledPlanType}${effectiveLabel}.`}
      />
    );
  }

  return null;
}
