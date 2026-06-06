"use client";

import { useEffect, useState } from "react";
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

export function PlatformAdminOverviewPage() {
  const [session, setSession] = useState<PlatformAdminSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      setSession(await getPlatformAdminSession());
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
      ) : null}
    </div>
  );
}
