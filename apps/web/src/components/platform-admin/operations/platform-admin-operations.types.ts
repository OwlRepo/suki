export type AutomationJobRunStatus = "running" | "completed" | "failed";
export type OperationsAlertSeverity = "info" | "warning" | "critical";
export type OperationsAlertStatus = "open" | "acknowledged" | "resolved";
export type ProviderHealthStatus = "healthy" | "degraded" | "down" | "unknown";

export type PlatformAdminAutomationRun = {
  id: string;
  jobKey: string;
  status: AutomationJobRunStatus;
  processedCount: number;
  successCount: number;
  failureCount: number;
  errorSummary: unknown | null;
  startedAt: string;
  finishedAt: string | null;
};

export type PlatformAdminAutomationRunsResponse = {
  items: PlatformAdminAutomationRun[];
  summary: {
    lastAppointmentReminderRun: string | null;
    lastInactivityWinbackRun: string | null;
    lastSemaphoreReconciliationRun: string | null;
    failedRunsLast24h: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type PlatformAdminProviderHealthSnapshot = {
  provider: string;
  status: ProviderHealthStatus;
  creditBalance: number | null;
  metrics: unknown | null;
  observedAt: string;
};

export type PlatformAdminProviderHealthResponse = {
  providers: PlatformAdminProviderHealthSnapshot[];
  history?: PlatformAdminProviderHealthSnapshot[];
};

export type PlatformAdminOperationsAlert = {
  id: string;
  alertKey: string;
  severity: OperationsAlertSeverity;
  status: OperationsAlertStatus;
  provider: string | null;
  title: string;
  description: string;
  metadata: unknown | null;
  detectedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
};

export type PlatformAdminAlertsResponse = {
  items: PlatformAdminOperationsAlert[];
  summary: {
    openCriticalAlerts: number;
    openWarningAlerts: number;
    acknowledgedAlerts: number;
    resolvedAlertsLast24h: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type PlatformAdminOperationsOverview = {
  providerHealth: PlatformAdminProviderHealthSnapshot[];
  criticalAlerts: number;
  failedAutomationRunsLast24h: number;
};
