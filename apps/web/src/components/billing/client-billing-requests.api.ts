import { apiRequest } from "@/lib/api";
import type {
  ClientBillingRequestKind,
  ClientBillingRequestStatus,
  PlanType,
} from "@tyvera/types";

export type ClientBillingRequest = {
  id: string;
  organizationId: string;
  kind: ClientBillingRequestKind;
  requestedPlanType: PlanType | null;
  requestedSku: string | null;
  requestedQuantity: number | null;
  note: string | null;
  status: ClientBillingRequestStatus;
  linkedBillingRequestId: string | null;
  reviewedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
};

export function listClientBillingRequests(token: string) {
  return apiRequest<{ clientBillingRequests: ClientBillingRequest[] }>(
    "/billing/requests",
    { token },
  );
}

export function createClientBillingRequest(
  token: string,
  input: {
    kind: ClientBillingRequestKind;
    requestedPlanType?: PlanType | null;
    requestedSku?: string | null;
    requestedQuantity?: number | null;
    note?: string | null;
  },
) {
  return apiRequest<ClientBillingRequest>("/billing/requests", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export function cancelClientBillingRequest(token: string, requestId: string) {
  return apiRequest<ClientBillingRequest>(
    `/billing/requests/${requestId}/cancel`,
    { method: "POST", token },
  );
}
