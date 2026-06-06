"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { StatusBanner } from "@/components/ui/status-banner";
import {
  listPlatformAdminBusinesses,
  type PlatformAdminBusinessListItem,
} from "./platform-admin-businesses.api";

export function PlatformAdminBusinessesPage() {
  const [businesses, setBusinesses] = useState<PlatformAdminBusinessListItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listPlatformAdminBusinesses(search);
      setBusinesses(response.organizations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load businesses");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="w-full space-y-6 sm:space-y-8">
      <PageHeader
        title="Businesses"
        plainLanguageDescription="Find tenant organizations and review their manual billing and credit state."
        whatThisPageIsFor="Use this page before creating top-up requests or applying SMS credit adjustments."
        whatToDoNext="Search an organization, open its detail page, then review credits and billing history."
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
        <Label htmlFor="businessSearch">Search organizations</Label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input
            id="businessSearch"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Organization name"
          />
          <Button type="button" className="gap-2" onClick={() => void refresh()}>
            <Search className="size-4" />
            Search
          </Button>
        </div>
      </section>

      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-bold text-slate-950">Loading businesses</h2>
          <ListSkeleton rowCount={5} className="mt-4" />
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

      {!loading && !error && businesses.length === 0 ? (
        <EmptyState
          what="No businesses found"
          why="Try a different search term or refresh the list."
          nextAction={
            <Button type="button" variant="outline" onClick={() => void refresh()}>
              Refresh
            </Button>
          }
        />
      ) : null}

      {!loading && !error && businesses.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-3">
            {businesses.map((business) => (
              <Link
                key={business.id}
                href={`/platform-admin/businesses/${business.id}`}
                className="rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950">{business.name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      SMS remaining: {business.smsRemaining}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Badge variant="outline">{business.currentPlan}</Badge>
                    <Badge variant="secondary">{formatStatus(business.billingStatus)}</Badge>
                    {business.latestManualBillingRequestStatus ? (
                      <Badge variant="outline">
                        {formatStatus(business.latestManualBillingRequestStatus)}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function formatStatus(value: string) {
  return value.replace(/_/g, " ");
}
