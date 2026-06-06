import { apiRequest } from "@/lib/api";

export type ManualBillingRequestStatus =
  | "draft"
  | "awaiting_payment"
  | "payment_reported"
  | "paid_and_fulfilled"
  | "rejected"
  | "void";

export type BillingRequestListItem = {
  id: string;
  referenceNumber: string;
  organizationId: string;
  organizationName: string;
  status: ManualBillingRequestStatus;
  totalAmountPhp: number;
  dueAt: string | null;
  createdAt: string;
  itemSummary: string;
};

export type BillingRequestDetail = BillingRequestListItem & {
  notes?: string | null;
  paymentInstructions: { copyText: string };
  items: Array<{
    id: string;
    sku: string;
    purchaseKind: string;
    units: number;
    unitPricePhp: number;
    quantity: number;
    totalAmountPhp: number;
  }>;
  payments: Array<{
    id: string;
    method: string;
    amountPhp: number;
    status: string;
    externalReference?: string | null;
    proofUrl?: string | null;
    notes?: string | null;
    createdAt?: string;
  }>;
  fulfillments: Array<Record<string, unknown>>;
  auditLogs: Array<Record<string, unknown>>;
};

export function listPlatformAdminBillingRequests(status = "all") {
  const query = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
  return apiRequest<{ billingRequests: BillingRequestListItem[] }>(
    `/platform-admin/billing-requests${query}`,
  );
}

export function getPlatformAdminBillingRequest(billingRequestId: string) {
  return apiRequest<BillingRequestDetail>(
    `/platform-admin/billing-requests/${billingRequestId}`,
  );
}

export function createPlatformAdminBillingRequest(input: {
  organizationId: string;
  sku: string;
  quantity: number;
  dueAt?: string | null;
  notes?: string | null;
}) {
  return apiRequest<{ billingRequest: BillingRequestDetail; paymentInstructions: { copyText: string } }>(
    "/platform-admin/billing-requests",
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function recordManualPayment(
  billingRequestId: string,
  input: {
    method: "gcash" | "bank_transfer" | "other";
    amountPhp: number;
    externalReference?: string | null;
    proofUrl?: string | null;
    notes?: string | null;
  },
) {
  return apiRequest<BillingRequestDetail>(
    `/platform-admin/billing-requests/${billingRequestId}/payments`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function confirmManualPaymentAndFulfill(paymentId: string) {
  return apiRequest<BillingRequestDetail>(
    `/platform-admin/manual-payments/${paymentId}/confirm-and-fulfill`,
    { method: "POST" },
  );
}

export function rejectManualPayment(paymentId: string) {
  return apiRequest<BillingRequestDetail>(
    `/platform-admin/manual-payments/${paymentId}/reject`,
    { method: "POST" },
  );
}

export function voidBillingRequest(billingRequestId: string) {
  return apiRequest<BillingRequestDetail>(
    `/platform-admin/billing-requests/${billingRequestId}/void`,
    { method: "POST" },
  );
}
