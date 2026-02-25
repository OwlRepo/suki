"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

export interface BillingStatusResponse {
  status: string;
  planType: string;
  readOnly?: boolean;
  billingStatus?: string;
  currentPlan?: string;
  trialStartsAt?: string | null;
  trialEndsAt?: string | null;
  daysRemaining?: number | null;
  isReadOnly?: boolean;
  nextBillingDueAt?: string | null;
  manualBillingNotes?: string | null;
  subscription: {
    planType?: string;
    status?: string;
    currentPeriodEnd?: string;
  } | null;
}

export function useBillingStatus(enabled: boolean) {
  const { getToken } = useAuth();
  const [billing, setBilling] = useState<BillingStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const res = await apiRequest<BillingStatusResponse>("/billing/status", {
          token,
        });
        if (!cancelled) setBilling(res);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, getToken]);

  const readOnly = billing?.readOnly ?? billing?.isReadOnly ?? false;
  const daysRemaining = billing?.daysRemaining ?? null;

  return { billing, loading, error, readOnly, daysRemaining };
}
