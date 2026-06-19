import { apiRequest } from "@/lib/api";
import type {
  ClientBillingRequestKind,
  ClientBillingRequestStatus,
  PlanType,
} from "@tyvera/types";

export type PlatformAdminClientBillingRequest = {
  id: string;
  organizationId: string;
  organizationName: string;
  kind: ClientBillingRequestKind;
  status: ClientBillingRequestStatus;
  requestedPlanType: PlanType | null;
  requestedSku: string | null;
  requestedQuantity: number | null;
  note: string | null;
  decisionNote: string | null;
  linkedBillingRequestId: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export function listPlatformAdminClientBillingRequests(status = "all") {
  const query = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
  return apiRequest<{
    clientBillingRequests: PlatformAdminClientBillingRequest[];
  }>(`/platform-admin/client-billing-requests${query}`);
}

export function getPlatformAdminClientBillingRequest(requestId: string) {
  return apiRequest<PlatformAdminClientBillingRequest>(
    `/platform-admin/client-billing-requests/${requestId}`,
  );
}

export function startPlatformAdminClientBillingRequestReview(requestId: string) {
  return apiRequest<PlatformAdminClientBillingRequest>(
    `/platform-admin/client-billing-requests/${requestId}/start-review`,
    { method: "POST" },
  );
}

export function approvePlatformAdminClientBillingRequest(
  requestId: string,
  input: { decisionNote?: string | null },
) {
  return apiRequest<PlatformAdminClientBillingRequest>(
    `/platform-admin/client-billing-requests/${requestId}/approve`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function declinePlatformAdminClientBillingRequest(
  requestId: string,
  input: { decisionNote: string },
) {
  return apiRequest<PlatformAdminClientBillingRequest>(
    `/platform-admin/client-billing-requests/${requestId}/decline`,
    { method: "POST", body: JSON.stringify(input) },
  );
}
