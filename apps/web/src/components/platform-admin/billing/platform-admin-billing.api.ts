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

export type ManualBillingEmailDelivery = {
  id: string;
  billingRequestId: string;
  manualPaymentId?: string | null;
  kind: "payment_request" | "payment_acknowledgment";
  recipientEmail?: string | null;
  status:
    | "skipped_missing_recipient"
    | "skipped_disabled"
    | "sent"
    | "failed";
  providerMessageId?: string | null;
  failureReason?: string | null;
  attemptedAt: string;
  sentAt?: string | null;
};

export type BillingRequestDetail = BillingRequestListItem & {
  notes?: string | null;
  manualBillingControlsEnabled: boolean;
  paymentInstructions: { copyText: string };
  items: Array<{
    id: string;
    sku: string;
    purchaseKind: string;
    units: number;
    unitPricePhp: number;
    quantity: number;
    totalAmountPhp: number;
    planType?: "starter" | "growth" | "pro" | null;
    billingInterval?: "monthly" | null;
    coverageStartsAt?: string | null;
    coverageEndsAt?: string | null;
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
  emailDeliveries: ManualBillingEmailDelivery[];
  latestPaymentRequestEmailDelivery?: ManualBillingEmailDelivery | null;
  latestPaymentAcknowledgmentEmailDelivery?: ManualBillingEmailDelivery | null;
};

export type ManualSubscriptionSku =
  | "starter-monthly"
  | "growth-monthly"
  | "pro-monthly";

export type ManualBillingCatalogItem = {
  sku: string;
  purchaseKind:
    | "subscription"
    | "online_booking_topup"
    | "sms_segment_topup";
  units?: number;
  pricePhp: number;
  planType?: "starter" | "growth" | "pro";
  billingInterval?: "monthly";
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
  coverageStartsAt?: string | null;
}) {
  return apiRequest<{
    billingRequest: BillingRequestDetail;
    paymentInstructions: { copyText: string };
    emailDelivery: ManualBillingEmailDelivery;
  }>(
    "/platform-admin/billing-requests",
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function getPlatformAdminManualBillingCatalog() {
  return apiRequest<{
    manualBillingControlsEnabled: boolean;
    items: ManualBillingCatalogItem[];
  }>("/platform-admin/billing/manual-catalog");
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

export function sendPlatformAdminPaymentRequestEmail(
  billingRequestId: string,
) {
  return apiRequest<ManualBillingEmailDelivery>(
    `/platform-admin/billing-requests/${billingRequestId}/send-payment-request-email`,
    { method: "POST" },
  );
}

export function sendPlatformAdminPaymentAcknowledgmentEmail(
  billingRequestId: string,
) {
  return apiRequest<ManualBillingEmailDelivery>(
    `/platform-admin/billing-requests/${billingRequestId}/send-payment-acknowledgment-email`,
    { method: "POST" },
  );
}
