"use client";

export type BillingInterval = "monthly" | "annual";

export interface BillingPlan {
  planType: "free" | "starter" | "growth" | "pro";
  displayName: string;
  monthlyPricePhp: number;
  annualPricePhp: number | null;
  mostPopular?: boolean;
  limits: {
    branches: number;
    staffAccounts: number;
    customerRecords: number;
    staffCreatedAppointmentsPerMonth: number | null;
    verifiedOnlineBookingsPerMonth: number;
    emailMessagesPerMonth: number;
    aiRequestsPerMonth: number;
  };
  modules: string[];
}

export interface BillingPlanCta {
  label: string;
  href?: string;
  disabled?: boolean;
  disabledHelper?: string;
}
