"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  listPlatformAdminAutomationRuns,
} from "./platform-admin-operations.api";
import { PlatformAdminProviderHealthCard } from "./platform-admin-provider-health-card";
import type {
  AutomationJobRunStatus,
  PlatformAdminAutomationRun,
  PlatformAdminAutomationRunsResponse,
  PlatformAdminProviderHealthSnapshot,
} from "./platform-admin-operations.types";

const CARD_CLASS = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";

export function PlatformAdminAutomationRunsPage() {
  const [runs, setRuns] = useState<PlatformAdminAutomationRun[]>([]);
  const [summary, setSummary] =
    useState<PlatformAdminAutomationRunsResponse["summary"] | null>(null);
  const [providers, setProviders] = useState<PlatformAdminProviderHealthSnapshot[]>([]);
  const [filters, setFilters] = useState<{
    jobKey?: string;
    status?: AutomationJobRunStatus | "all";
    from?: string;
    to?: string;
  }>({ status: "all" });
  const [draftFilters, setDraftFilters] = useState(filters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (nextFilters = filters) => {
    setLoading(true);
    setError(null);
    try {
      const [runResponse, providerResponse] = await Promise.all([
        listPlatformAdminAutomationRuns({
          ...nextFilters,
          status: nextFilters.status === "all" ? undefined : nextFilters.status,
          limit: 25,
        }),
        getPlatformAdminProviderHealth(),
      ]);
      setRuns(runResponse.items);
      setSummary(runResponse.summary);
      setProviders(providerResponse.providers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load automation runs");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void refresh(filters);
  }, [refresh, filters]);

  function applyFilters() {
    setFilters(draftFilters);
    void refresh(draftFilters);
  }

  return (
    <div className="w-full space-y-6 sm:space-y-8">
      <PageHeader
        title="Automation Runs"
        plainLanguageDescription="Review whether Tyvera background jobs are running successfully."
        whatThisPageIsFor="Check appointment reminders, winback jobs, and Semaphore reconciliation health."
        whatToDoNext="Investigate failed or missing runs before customer reminders are affected."
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
          <h2 className="text-base font-bold text-slate-950">
            Loading automation runs
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Checking scheduler history and recent provider snapshots.
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
            <MetricCard label="Last appointment reminder run" value={formatDateTime(summary?.lastAppointmentReminderRun)} />
            <MetricCard label="Last inactivity winback run" value={formatDateTime(summary?.lastInactivityWinbackRun)} />
            <MetricCard label="Last Semaphore reconciliation run" value={formatDateTime(summary?.lastSemaphoreReconciliationRun)} />
            <MetricCard label="Failed runs in last 24 hours" value={summary?.failedRunsLast24h ?? 0} />
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
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="job-key">Job key</Label>
                <Input
                  id="job-key"
                  value={draftFilters.jobKey ?? ""}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      jobKey: event.target.value,
                    }))
                  }
                  placeholder="appointment_reminders"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={draftFilters.status ?? "all"}
                  onValueChange={(value) =>
                    setDraftFilters((current) => ({
                      ...current,
                      status: value as AutomationJobRunStatus | "all",
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="running">Running</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="from">From</Label>
                <Input
                  id="from"
                  type="date"
                  value={draftFilters.from ?? ""}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      from: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex items-end">
                <Button type="button" onClick={applyFilters} className="w-full">
                  Apply filters
                </Button>
              </div>
            </div>
          </section>

          {runs.length === 0 ? (
            <EmptyState
              what="No automation runs found"
              why="Scheduler executions will appear here after appointment reminders, winback jobs, or Semaphore reconciliation run."
            />
          ) : (
            <section className={CARD_CLASS}>
              <div className="grid gap-3">
                {runs.map((run) => (
                  <article
                    key={run.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-slate-950">{run.jobKey}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          Started {formatDateTime(run.startedAt)}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          Finished {formatDateTime(run.finishedAt)}
                        </p>
                      </div>
                      <Badge variant="outline">{run.status}</Badge>
                    </div>
                    <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                      <p>Processed: {run.processedCount}</p>
                      <p>Succeeded: {run.successCount}</p>
                      <p>Failed: {run.failureCount}</p>
                    </div>
                    {run.errorSummary ? (
                      <pre className="mt-3 whitespace-pre-wrap text-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                        {JSON.stringify(run.errorSummary, null, 2)}
                      </pre>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <section className={CARD_CLASS}>
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
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
