"use client";

import { StatusBanner } from "@/components/ui/status-banner";

export function CheckoutSyncBanner({
  syncing,
  timedOut,
  delayedSyncWarning,
}: {
  syncing: boolean;
  timedOut: boolean;
  delayedSyncWarning?: string | null;
}) {
  if (delayedSyncWarning) {
    return <StatusBanner variant="warning" message={delayedSyncWarning} />;
  }

  if (timedOut) {
    return (
      <StatusBanner
        variant="warning"
        message="Your payment was received, but activation is still syncing. Refresh shortly or contact support if this continues."
      />
    );
  }

  if (!syncing) return null;

  return (
    <StatusBanner
      variant="info"
      message="Payment received. Activating your plan..."
    />
  );
}
