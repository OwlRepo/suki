"use client";

import { useMemo } from "react";
import { useBillingStatus } from "@/hooks/use-billing-status";
import { getPlanCapabilities } from "@/lib/plan-capabilities";

export function usePlanCapabilities() {
  const { billing, loading, error, readOnly, daysRemaining } = useBillingStatus(true);
  const capabilities = useMemo(
    () => getPlanCapabilities(billing?.planType ?? null),
    [billing?.planType],
  );

  return {
    ...capabilities,
    billing,
    loading,
    error,
    readOnly,
    daysRemaining,
  };
}
