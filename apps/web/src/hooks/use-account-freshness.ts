"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";

export interface AccountSummary {
  businesses: number;
  customers: number;
  appointments: number;
  promos: number;
  customersWithVisits?: number;
}

export function useAccountSummary() {
  const { getToken } = useAuth();
  const [summary, setSummary] = useState<AccountSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const res = await apiRequest<AccountSummary>("/admin/summary", { token });
        if (!cancelled) {
          setSummary({
            businesses: res.businesses ?? 0,
            customers: res.customers ?? 0,
            appointments: res.appointments ?? 0,
            promos: res.promos ?? 0,
            customersWithVisits: res.customersWithVisits ?? 0,
          });
        }
      } catch {
        if (!cancelled) setSummary(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  return {
    summary,
    loading: summary === null,
    isFresh:
      summary !== null &&
      summary.customers === 0 &&
      summary.appointments === 0 &&
      summary.promos === 0,
  };
}

/** @deprecated Use useAccountSummary and isFresh from it */
export function useAccountFreshness() {
  const { summary, loading, isFresh } = useAccountSummary();
  return { isFresh, loading };
}
