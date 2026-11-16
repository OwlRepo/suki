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
  let statusMessage: string | null = null;
  let variant: "info" | "warning" = "info";
  if (billingStatus === "subscription_past_due") {
    variant = "warning";
    statusMessage = "Your account is past due. New variable-cost actions are temporarily blocked until payment is recovered.";
  } else if (billingStatus === "subscription_paused") {
    variant = "warning";
    statusMessage = "Your subscription is temporarily paused. New variable-cost actions stay blocked until billing resumes.";
  } else if (billingStatus === "subscription_cancelled") {
    statusMessage = "Cancellation is scheduled. Your current access stays active until the end of the billing period.";
  } else if (cancellationPending) {
    statusMessage = "Cancellation is pending. Your current access stays active until the end of the billing period.";
  }

  if (!statusMessage && !scheduledPlanType) return null;
  const effectiveLabel = scheduledChangeEffectiveAt
    ? ` on ${new Date(scheduledChangeEffectiveAt).toLocaleDateString("en-PH")}`
    : "";

  return (
    <div className="space-y-3">
      {statusMessage ? <StatusBanner variant={variant} message={statusMessage} /> : null}
      {scheduledPlanType ? <StatusBanner variant="info" message={`Your plan is scheduled to move to ${scheduledPlanType}${effectiveLabel}.`} /> : null}
    </div>
  );
}
