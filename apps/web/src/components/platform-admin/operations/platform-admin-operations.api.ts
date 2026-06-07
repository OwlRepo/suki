import { apiRequest } from "@/lib/api";
import type {
  AutomationJobRunStatus,
  OperationsAlertSeverity,
  OperationsAlertStatus,
  PlatformAdminAlertsResponse,
  PlatformAdminAutomationRunsResponse,
  PlatformAdminOperationsOverview,
  PlatformAdminProviderHealthResponse,
} from "./platform-admin-operations.types";

function buildQuery(input: Record<string, string | number | undefined | null>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function listPlatformAdminAutomationRuns(filters: {
  jobKey?: string;
  status?: AutomationJobRunStatus | "all";
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
} = {}) {
  return apiRequest<PlatformAdminAutomationRunsResponse>(
    `/platform-admin/automation-runs${buildQuery(filters)}`,
  );
}

export function getPlatformAdminProviderHealth() {
  return apiRequest<PlatformAdminProviderHealthResponse>(
    "/platform-admin/provider-health",
  );
}

export function listPlatformAdminAlerts(filters: {
  status?: OperationsAlertStatus | "all";
  severity?: OperationsAlertSeverity | "all";
  provider?: string;
  page?: number;
  limit?: number;
} = {}) {
  return apiRequest<PlatformAdminAlertsResponse>(
    `/platform-admin/alerts${buildQuery(filters)}`,
  );
}

export function updatePlatformAdminAlert(
  alertId: string,
  body: { action: "acknowledge" | "resolve" },
) {
  return apiRequest<{ ok: true }>(`/platform-admin/alerts/${alertId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function getPlatformAdminOperationsOverview(): Promise<PlatformAdminOperationsOverview> {
  const [providerHealth, alerts, automationRuns] = await Promise.all([
    getPlatformAdminProviderHealth(),
    listPlatformAdminAlerts({ limit: 1 }),
    listPlatformAdminAutomationRuns({ limit: 1 }),
  ]);

  return {
    providerHealth: providerHealth.providers,
    criticalAlerts: alerts.summary.openCriticalAlerts,
    failedAutomationRunsLast24h: automationRuns.summary.failedRunsLast24h,
  };
}
