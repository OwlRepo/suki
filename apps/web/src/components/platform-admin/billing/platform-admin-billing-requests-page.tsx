"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { StatusBanner } from "@/components/ui/status-banner";
import {
  listPlatformAdminBillingRequests,
  type BillingRequestListItem,
  type ManualBillingRequestStatus,
} from "./platform-admin-billing.api";

const STATUS_FILTERS: Array<ManualBillingRequestStatus | "all"> = [
  "all",
  "draft",
  "awaiting_payment",
  "payment_reported",
  "paid_and_fulfilled",
  "rejected",
  "void",
];

export function PlatformAdminBillingRequestsPage() {
  const [billingRequests, setBillingRequests] = useState<BillingRequestListItem[]>([]);
  const [status, setStatus] = useState<ManualBillingRequestStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (nextStatus = status) => {
    setLoading(true);
    setError(null);
    try {
      const response = await listPlatformAdminBillingRequests(nextStatus);
      setBillingRequests(response.billingRequests);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load billing requests",
      );
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
        title="Billing Requests"
        plainLanguageDescription="Create and verify manual Tyvera add-on payments for tenant organizations."
        whatThisPageIsFor="Use this page to track request status, reported payments, and completed fulfillment."
        whatToDoNext="Filter by status, open a request, then record or verify payment when finance confirms the transfer."
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

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
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
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-bold text-slate-950">
            Loading billing requests
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Checking manual requests and payment statuses.
          </p>
          <ListSkeleton rowCount={5} className="mt-4" />
        </section>
      ) : null}

      {error ? (
        <div className="space-y-3">
          <StatusBanner
            variant="error"
            message={error}
            onDismiss={() => setError(null)}
          />
          <div>
            <Button type="button" variant="outline" onClick={() => void refresh()}>
              Retry
            </Button>
          </div>
        </div>
      ) : null}

      {!loading && !error && billingRequests.length === 0 ? (
        <EmptyState
          what="No billing requests yet"
          why="Manual add-on requests will appear here after finance creates them for a tenant organization."
        />
      ) : null}

      {!loading && !error && billingRequests.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-3">
            {billingRequests.map((request) => (
              <Link
                key={request.id}
                href={`/platform-admin/billing-requests/${request.id}`}
                className="rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-950">
                      {request.referenceNumber}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {request.organizationName}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {request.itemSummary}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <Badge variant="outline">{formatStatus(request.status)}</Badge>
                    <span className="text-sm font-semibold text-slate-950">
                      {formatPhp(request.totalAmountPhp)}
                    </span>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                  <p>Due: {formatDate(request.dueAt) || "Not set"}</p>
                  <p>Created: {formatDate(request.createdAt)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function formatPhp(amount: number) {
  return `₱${new Intl.NumberFormat("en-PH").format(amount)}`;
}

function formatDate(value?: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
