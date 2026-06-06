"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { StatusBanner } from "@/components/ui/status-banner";
import {
  listPlatformAdminAuditLogs,
  type PlatformAdminAuditLog,
} from "./platform-admin-audit.api";

export function PlatformAdminAuditLogsPage() {
  const [auditLogs, setAuditLogs] = useState<PlatformAdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const response = await listPlatformAdminAuditLogs();
      setAuditLogs(response.auditLogs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load audit logs");
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
        title="Audit Logs"
        plainLanguageDescription="Review sensitive platform-admin billing and credit actions."
        whatThisPageIsFor="Use this page to confirm who changed manual billing, payments, or credit balances."
        whatToDoNext="Search the newest events first, then open the related request or business when more context is needed."
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
          <h2 className="text-base font-bold text-slate-950">Loading audit logs</h2>
          <ListSkeleton rowCount={6} className="mt-4" />
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

      {!loading && !error && auditLogs.length === 0 ? (
        <EmptyState
          what="No audit logs yet"
          why="Manual billing and credit actions will appear here after platform admins perform them."
          nextAction={
            <Button type="button" variant="outline" onClick={() => void refresh()}>
              Refresh
            </Button>
          }
        />
      ) : null}

      {!loading && !error && auditLogs.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-3">
            {auditLogs.map((log) => (
              <article key={log.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950">{log.action}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {log.entity}
                      {log.entityId ? ` · ${log.entityId}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline">{formatDate(log.createdAt)}</Badge>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
