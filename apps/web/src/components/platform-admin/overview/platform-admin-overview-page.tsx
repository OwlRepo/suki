"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { StatusBanner } from "@/components/ui/status-banner";
import {
  getPlatformAdminSession,
} from "@/components/platform-admin/platform-admin.api";
import type { PlatformAdminSession } from "@/components/platform-admin/platform-admin.types";
import {
  getPlatformAdminCommunicationsSummary,
} from "@/components/platform-admin/communications/platform-admin-communications.api";
import type {
  PlatformAdminCommunicationsSummary,
} from "@/components/platform-admin/communications/platform-admin-communications.types";
import {
  getPlatformAdminOperationsOverview,
} from "@/components/platform-admin/operations/platform-admin-operations.api";
import type {
  PlatformAdminOperationsOverview,
  PlatformAdminProviderHealthSnapshot,
} from "@/components/platform-admin/operations/platform-admin-operations.types";

export function PlatformAdminOverviewPage() {
  const [session, setSession] = useState<PlatformAdminSession | null>(null);
  const [communicationsSummary, setCommunicationsSummary] =
    useState<PlatformAdminCommunicationsSummary | null>(null);
  const [operationsOverview, setOperationsOverview] =
    useState<PlatformAdminOperationsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const sessionResponse = await getPlatformAdminSession();
      setSession(sessionResponse);
      if (sessionResponse.permissions.includes("COMMUNICATION_VIEW")) {
        setCommunicationsSummary(
          await getPlatformAdminCommunicationsSummary({ range: "24h" }),
        );
      } else {
        setCommunicationsSummary(null);
      }
      if (
        sessionResponse.permissions.includes("ALERT_VIEW") &&
        sessionResponse.permissions.includes("AUTOMATION_RUN_VIEW")
      ) {
        setOperationsOverview(await getPlatformAdminOperationsOverview());
      } else {
        setOperationsOverview(null);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load platform-admin session",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="w-full space-y-6 sm:space-y-8">
      <PageHeader
        title="Platform Admin"
        plainLanguageDescription="Internal Tyvera operations access is active for this signed-in account."
        whatThisPageIsFor="Confirm your internal role and permission set before using platform-admin tools."
        whatToDoNext="Use this overview as the starting point for future internal operations workflows."
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
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <RefreshCw className="size-5 animate-spin" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-950">
                Loading internal session
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Checking your platform-admin role and permissions.
              </p>
            </div>
          </div>
          <ListSkeleton rowCount={3} className="mt-4" />
        </section>
      ) : null}

      {error ? (
        <StatusBanner
          variant="error"
          message={error}
          onDismiss={() => setError(null)}
        />
      ) : null}

      {!loading && !error && session ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <ShieldCheck className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-950">
                      Internal access verified
                    </h2>
                    <p className="mt-1 break-all text-sm leading-6 text-slate-600">
                      User ID: {session.platformAdmin.userId}
                    </p>
                  </div>
                  <Badge variant="secondary">{session.platformAdmin.status}</Badge>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Roles</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {session.roles.map((role) => (
                        <Badge key={role} variant="outline">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      Permissions
                    </p>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                      {session.permissions.length}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Database-backed permissions resolved for this session.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {communicationsSummary ? (
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <OverviewMetricCard
                label="SMS failures in last 24 hours"
                value={communicationsSummary.totals.smsFailed}
                href="/platform-admin/communications"
              />
              <OverviewMetricCard
                label="Email failures in last 24 hours"
                value={communicationsSummary.totals.emailFailed}
                href="/platform-admin/communications"
              />
              <OverviewMetricCard
                label="Open manual follow-ups"
                value={communicationsSummary.totals.openManualFollowUps}
                href="/platform-admin/communications"
              />
              <OverviewMetricCard
                label="OTP failures in last 24 hours"
                value={communicationsSummary.totals.otpSendFailures}
                href="/platform-admin/communications"
              />
            </section>
          ) : null}

          {operationsOverview ? (
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <OverviewMetricCard
                label="Semaphore provider health"
                value={formatProviderHealth(
                  operationsOverview.providerHealth.find(
                    (provider) => provider.provider === "semaphore",
                  ),
                )}
                href="/platform-admin/alerts"
              />
              <OverviewMetricCard
                label="Resend provider health"
                value={formatProviderHealth(
                  operationsOverview.providerHealth.find(
                    (provider) => provider.provider === "resend",
                  ),
                )}
                href="/platform-admin/alerts"
              />
              <OverviewMetricCard
                label="Critical alerts"
                value={operationsOverview.criticalAlerts}
                href="/platform-admin/alerts"
              />
              <OverviewMetricCard
                label="Failed automation runs"
                value={operationsOverview.failedAutomationRunsLast24h}
                href="/platform-admin/automation-runs"
              />
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function OverviewMetricCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number | string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:bg-slate-50 sm:p-5"
    >
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">
        {typeof value === "number"
          ? new Intl.NumberFormat("en-PH").format(value)
          : value}
      </p>
    </Link>
  );
}

function formatProviderHealth(
  snapshot: PlatformAdminProviderHealthSnapshot | undefined,
) {
  if (!snapshot) return "Unknown";
  if (snapshot.creditBalance !== null) {
    return `${snapshot.status} (${new Intl.NumberFormat("en-PH").format(snapshot.creditBalance)})`;
  }
  return snapshot.status;
}
