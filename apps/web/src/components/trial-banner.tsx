"use client";

import { useAuthSync } from "@/hooks/use-auth-sync";
import { useBillingStatus } from "@/hooks/use-billing-status";

export function TrialBanner() {
  const { data: syncData } = useAuthSync();
  const organizationId = syncData?.organization?.id ?? null;
  const { billing, loading } = useBillingStatus(!!organizationId);

  if (loading || !billing) return null;
  return null;
}
