import { apiRequest } from "@/lib/api";
import type {
  PlatformAdminCommunicationDetail,
  PlatformAdminCommunicationFilters,
  PlatformAdminCommunicationListResponse,
  PlatformAdminCommunicationsSummary,
} from "./platform-admin-communications.types";

function buildQuery(
  filters: PlatformAdminCommunicationFilters,
  keys: Array<keyof PlatformAdminCommunicationFilters>,
) {
  const params = new URLSearchParams();
  for (const key of keys) {
    const value = filters[key];
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function listPlatformAdminCommunications(
  filters: PlatformAdminCommunicationFilters = {},
) {
  const query = buildQuery(filters, [
    "channel",
    "provider",
    "deliveryStatus",
    "automationKey",
    "organizationId",
    "businessId",
    "page",
    "limit",
  ]);
  return apiRequest<PlatformAdminCommunicationListResponse>(
    `/platform-admin/communications${query}`,
  );
}

export function getPlatformAdminCommunicationsSummary(
  filters: Pick<
    PlatformAdminCommunicationFilters,
    "range" | "organizationId" | "businessId"
  > = {},
) {
  const query = buildQuery(filters, ["range", "organizationId", "businessId"]);
  return apiRequest<PlatformAdminCommunicationsSummary>(
    `/platform-admin/communications/summary${query}`,
  );
}

export function getPlatformAdminCommunicationDetail(messageEventId: string) {
  return apiRequest<PlatformAdminCommunicationDetail>(
    `/platform-admin/communications/${messageEventId}`,
  );
}
