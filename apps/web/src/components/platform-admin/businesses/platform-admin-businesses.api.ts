import { apiRequest } from "@/lib/api";

export type PlatformAdminBusinessListItem = {
  id: string;
  name: string;
  currentPlan: string;
  billingStatus: string;
  smsRemaining: number;
  latestManualBillingRequestStatus: string | null;
};

export type PlatformAdminBusinessDetail = {
  organization: {
    id: string;
    name: string;
    currentPlan?: string | null;
    billingStatus?: string | null;
  };
  smsLedger: CreditLedger;
  verifiedBookingLedger: CreditLedger;
  recentSmsAddons: Array<Record<string, unknown>>;
  recentSmsUsage: Array<Record<string, unknown>>;
  recentBookingAddons: Array<Record<string, unknown>>;
  recentBookingUsage: Array<Record<string, unknown>>;
  billingRequests: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
  reconciliation: Array<Record<string, unknown>>;
};

export type CreditLedger = {
  month: string;
  included: number;
  addon: number;
  used: number;
  total: number;
  remaining: number;
};

export function listPlatformAdminBusinesses(search?: string) {
  const query = search?.trim()
    ? `?search=${encodeURIComponent(search.trim())}`
    : "";
  return apiRequest<{ organizations: PlatformAdminBusinessListItem[] }>(
    `/platform-admin/organizations${query}`,
  );
}

export function getPlatformAdminBusiness(organizationId: string) {
  return apiRequest<PlatformAdminBusinessDetail>(
    `/platform-admin/organizations/${organizationId}`,
  );
}

export function getPlatformAdminBillingAddons() {
  return apiRequest<{
    addons: Array<{
      sku: string;
      purchaseKind: string;
      units: number;
      pricePhp: number;
    }>;
  }>("/platform-admin/billing/addons");
}

export function createSmsAdjustment(
  organizationId: string,
  input: {
    type: "promotional_grant" | "admin_correction";
    units: number;
    reason: string;
  },
) {
  return apiRequest<{ smsLedger: CreditLedger }>(
    `/platform-admin/organizations/${organizationId}/sms-adjustments`,
    { method: "POST", body: JSON.stringify(input) },
  );
}
