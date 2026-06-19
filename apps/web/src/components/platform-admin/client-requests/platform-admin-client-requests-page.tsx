"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import type { ClientBillingRequestStatus } from "@tyvera/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { StatusBanner } from "@/components/ui/status-banner";
import {
  listPlatformAdminClientBillingRequests,
  type PlatformAdminClientBillingRequest,
} from "./platform-admin-client-requests.api";

const FILTERS: Array<ClientBillingRequestStatus | "all"> = [
  "all",
  "submitted",
  "under_review",
  "approved",
  "declined",
  "cancelled",
];

export function PlatformAdminClientRequestsPage() {
  const [requests, setRequests] = useState<
    PlatformAdminClientBillingRequest[]
  >([]);
  const [status, setStatus] =
    useState<ClientBillingRequestStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (nextStatus = status) => {
    setLoading(true);
    setError(null);
    try {
      const response =
        await listPlatformAdminClientBillingRequests(nextStatus);
      setRequests(response.clientBillingRequests);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load requests.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void refresh(status);
  }, [refresh, status]);

  return (
    <div className="w-full space-y-6 sm:space-y-8">
      <PageHeader
        title="Client Requests"
        plainLanguageDescription="Review billing changes submitted by workspace owners."
        whatThisPageIsFor="Use this inbox to validate plan changes, SMS top-ups, and cancellation intent before finance acts."
        whatToDoNext="Open a request, start review, then approve or decline with a clear note."
        actions={
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 sm:w-auto"
            onClick={() => void refresh()}
          >
            <RefreshCw className="size-4" aria-hidden />
            Refresh
          </Button>
        }
      />

      <section
        aria-label="Client request status filters"
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <Button
              key={filter}
              type="button"
              size="sm"
              variant={status === filter ? "default" : "outline"}
              onClick={() => setStatus(filter)}
            >
              {formatStatus(filter)}
            </Button>
          ))}
        </div>
      </section>

      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-950">Loading client requests</h2>
          <ListSkeleton rowCount={5} className="mt-4" />
        </section>
      ) : null}
      {error ? <StatusBanner variant="error" message={error} /> : null}
      {!loading && !error && requests.length === 0 ? (
        <EmptyState
          what="No client requests"
          why="Requests submitted from manual-mode billing settings will appear here."
        />
      ) : null}
      {!loading && !error && requests.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-3">
            {requests.map((request) => (
              <Link
                key={request.id}
                href={`/platform-admin/client-requests/${request.id}`}
                className="rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950">
                      {request.organizationName}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {requestSummary(request)}
                    </p>
                    {request.note ? (
                      <p className="mt-1 text-sm text-slate-500">
                        {request.note}
                      </p>
                    ) : null}
                  </div>
                  <Badge variant="outline">
                    {formatStatus(request.status)}
                  </Badge>
                </div>
                <p className="mt-3 text-sm tabular-nums text-slate-500">
                  Submitted {formatDate(request.createdAt)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function requestSummary(request: PlatformAdminClientBillingRequest) {
  if (request.kind === "plan_change") {
    return `Plan change → ${request.requestedPlanType}`;
  }
  if (request.kind === "sms_topup") {
    return `${request.requestedQuantity} × ${request.requestedSku}`;
  }
  return "Paid plan cancellation";
}

function formatStatus(value: string) {
  return value.replace(/_/g, " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
