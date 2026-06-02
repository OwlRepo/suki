"use client";

import { StatusBanner } from "@/components/ui/status-banner";

export function BillingStatusBanner({
  billingStatus,
}: {
  billingStatus: string;
}) {
  if (billingStatus === "subscription_past_due") {
    return (
      <StatusBanner
        variant="warning"
        message="Your account is past due. New variable-cost actions are temporarily blocked until payment is recovered."
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

  return null;
}
