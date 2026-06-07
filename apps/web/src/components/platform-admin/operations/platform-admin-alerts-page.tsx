"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListSkeleton, MetricGridSkeleton } from "@/components/ui/skeleton";
import { StatusBanner } from "@/components/ui/status-banner";
import {
  getPlatformAdminProviderHealth,
  listPlatformAdminAlerts,
  updatePlatformAdminAlert,
} from "./platform-admin-operations.api";
import { PlatformAdminProviderHealthCard } from "./platform-admin-provider-health-card";
import type {
  OperationsAlertSeverity,
  OperationsAlertStatus,
  PlatformAdminAlertsResponse,
  PlatformAdminOperationsAlert,
  PlatformAdminProviderHealthSnapshot,
} from "./platform-admin-operations.types";

const CARD_CLASS = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";

export function PlatformAdminAlertsPage() {
  const [alerts, setAlerts] = useState<PlatformAdminOperationsAlert[]>([]);
  const [summary, setSummary] =
    useState<PlatformAdminAlertsResponse["summary"] | null>(null);
  const [providers, setProviders] = useState<PlatformAdminProviderHealthSnapshot[]>([]);
  const [filters, setFilters] = useState<{
    status?: OperationsAlertStatus | "all";
    severity?: OperationsAlertSeverity | "all";
  }>({ status: "all", severity: "all" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingAlertId, setSubmittingAlertId] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] =
    useState<"acknowledge" | "resolve" | null>(null);

  const refresh = useCallback(async (nextFilters = filters) => {
    setLoading(true);
    setError(null);
    try {
      const [alertsResponse, providerResponse] = await Promise.all([
        listPlatformAdminAlerts({
          ...nextFilters,
          status: nextFilters.status === "all" ? undefined : nextFilters.status,
          severity:
            nextFilters.severity === "all" ? undefined : nextFilters.severity,
          limit: 25,
        }),
        getPlatformAdminProviderHealth(),
      ]);
      setAlerts(alertsResponse.items);
      setSummary(alertsResponse.summary);
      setProviders(providerResponse.providers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load alerts");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void refresh(filters);
  }, [refresh, filters]);

  async function submitAction(
    alertId: string,
    action: "acknowledge" | "resolve",
  ) {
    setSubmittingAlertId(alertId);
    setSubmittingAction(action);
    setError(null);
    try {
      await updatePlatformAdminAlert(alertId, { action });
      await refresh(filters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update alert");
    } finally {
      setSubmittingAlertId(null);
      setSubmittingAction(null);
    }
  }

  return (
    <div className="w-full space-y-6 sm:space-y-8">
      <PageHeader
        title="Alerts"
        plainLanguageDescription="Review operational issues that may need immediate action."
        whatThisPageIsFor="See provider-credit warnings, delivery failure spikes, OTP problems, and missed automation runs."
        whatToDoNext="Handle critical alerts first, then acknowledge or resolve them after investigation."
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => void refresh()}
            className="w-full gap-2 sm:w-auto"
          >
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        }
      />

      {loading ? (
        <section className={CARD_CLASS}>
          <h2 className="text-base font-bold text-slate-950">Loading alerts</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Checking open alerts, acknowledgements, and recent provider status.
          </p>
          <MetricGridSkeleton count={4} className="mt-4" />
          <ListSkeleton rowCount={5} className="mt-5" />
        </section>
      ) : null}

      {error ? (
        <div className="space-y-3">
          <StatusBanner variant="error" message={error} onDismiss={() => setError(null)} />
          <Button type="button" variant="outline" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      ) : null}

      {!loading && !error ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Open critical alerts" value={summary?.openCriticalAlerts ?? 0} />
            <MetricCard label="Open warning alerts" value={summary?.openWarningAlerts ?? 0} />
            <MetricCard label="Acknowledged alerts" value={summary?.acknowledgedAlerts ?? 0} />
            <MetricCard label="Resolved alerts in last 24 hours" value={summary?.resolvedAlertsLast24h ?? 0} />
          </section>

          {providers.length > 0 ? (
            <section className="grid gap-3 md:grid-cols-2">
              {providers.map((provider) => (
                <PlatformAdminProviderHealthCard
                  key={provider.provider}
                  snapshot={provider}
                />
              ))}
            </section>
          ) : null}

          <section className={CARD_CLASS}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Select
                value={filters.status ?? "all"}
                onValueChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    status: value as OperationsAlertStatus | "all",
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filters.severity ?? "all"}
                onValueChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    severity: value as OperationsAlertSeverity | "all",
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All severities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" onClick={() => void refresh(filters)}>
                Apply filters
              </Button>
            </div>
          </section>

          {alerts.length === 0 ? (
            <EmptyState
              what="No alerts found"
              why="Operational alerts will appear here when provider credits, delivery failures, OTP sends, or expected scheduler runs need attention."
            />
          ) : (
            <section className={CARD_CLASS}>
              <div className="grid gap-3">
                {alerts.map((alert) => {
                  const isSubmitting = submittingAlertId === alert.id;
                  return (
                    <article
                      key={alert.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={alert.severity === "critical" ? "destructive" : "outline"}>
                              {alert.severity}
                            </Badge>
                            <Badge variant="outline">{alert.status}</Badge>
                            {alert.provider ? (
                              <Badge variant="secondary">{alert.provider}</Badge>
                            ) : null}
                          </div>
                          <h2 className="mt-3 text-base font-bold text-slate-950">
                            {alert.title}
                          </h2>
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            {alert.description}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isSubmitting || alert.status !== "open"}
                            onClick={() => void submitAction(alert.id, "acknowledge")}
                          >
                            {isSubmitting && submittingAction === "acknowledge"
                              ? "Acknowledging"
                              : "Acknowledge"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={isSubmitting || alert.status === "resolved"}
                            onClick={() => void submitAction(alert.id, "resolve")}
                          >
                            {isSubmitting && submittingAction === "resolve"
                              ? "Resolving"
                              : "Resolve"}
                          </Button>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                        <p>Detected: {formatDateTime(alert.detectedAt)}</p>
                        <p>Acknowledged: {formatDateTime(alert.acknowledgedAt)}</p>
                        <p>Resolved: {formatDateTime(alert.resolvedAt)}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <section className={CARD_CLASS}>
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">
        {new Intl.NumberFormat("en-PH").format(value)}
      </p>
    </section>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
