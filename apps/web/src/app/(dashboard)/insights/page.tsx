"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { useWorkspace } from "@/contexts/workspace-context";
import { hasClerk } from "@/lib/clerk";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { MetricGridSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { TooltipBadge } from "@/components/onboarding";

interface Business {
  id: string;
  name: string;
}

interface Metrics {
  year: number;
  month: number;
  newCustomers: number;
  repeatCustomers: number;
  repeatVisits: number;
}

function InsightsPageContent() {
  const { getToken } = useAuth();
  const { data: syncData } = useAuthSync();
  const workspace = useWorkspace();
  const selectedBiz = workspace?.activeBusinessId ?? "";
  const businesses = workspace?.businesses ?? [];
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [showYearSelector, setShowYearSelector] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [syncReady, setSyncReady] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);

  useEffect(() => {
    if (!syncData) return;
    setSyncReady(true);
  }, [syncData]);

  useEffect(() => {
    if (!selectedBiz) return;
    setMetricsLoading(true);
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const res = await apiRequest<{ metrics: Metrics }>(
          `/insights/monthly?businessId=${selectedBiz}&year=${year}&month=${month}`,
          { token },
        );
        setMetrics(res.metrics);
      } catch {
        setMetrics(null);
      } finally {
        setMetricsLoading(false);
      }
    })();
  }, [selectedBiz, year, month, getToken]);

  if (!workspace?.loading && !businesses.length) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Business Summary</h1>
        <p className="mt-2 text-helper">Create a business in Setup first.</p>
      </div>
    );
  }

  const monthName = new Date(year, month - 1).toLocaleString("default", { month: "long" });

  return (
    <div className="space-y-8">
      <PageHeader
        title={<TooltipBadge screen="insights">Business Summary</TooltipBadge>}
        plainLanguageDescription="Meaningful numbers without intimidation. New customers are first-time visitors. Repeat customers are people who came back."
        whatThisPageIsFor="Understand customer growth and repeat behavior for the selected month."
        whatToDoNext="Review this month first, then use 'View past months' only if needed."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value, 10))}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[44px]"
              aria-label="Select month"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1).toLocaleString("default", { month: "long" })}
                </option>
              ))}
            </select>
            {showYearSelector ? (
              <>
                <select
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value, 10))}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[44px]"
                  aria-label="Select year"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <Button variant="ghost" size="sm" onClick={() => setShowYearSelector(false)}>
                  Hide year
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowYearSelector(true)}>
                View past months
              </Button>
            )}
          </div>
        }
      />

      <PageSection
        title={`${monthName} ${year}`}
        description={metrics ? undefined : "No metrics for this period."}
      >
        {!syncReady || workspace?.loading || (!!selectedBiz && metricsLoading) ? (
          <MetricGridSkeleton count={3} />
        ) : metrics ? (
          <div className="grid gap-6 sm:grid-cols-3">
            <MetricCard
              label="New customers"
              value={metrics.newCustomers}
              suffix={metrics.newCustomers === 0 ? "People who visited for the first time this month. This will grow as customers return." : "People who visited for the first time this month"}
            />
            <MetricCard
              label="Repeat visits"
              value={metrics.repeatVisits}
              suffix={metrics.repeatVisits === 0 ? "Total visits from returning customers. This will grow as customers return." : "Total visits from customers who've been here before"}
            />
            <MetricCard
              label="Repeat customers"
              value={metrics.repeatCustomers}
              suffix={metrics.repeatCustomers === 0 ? "People who came back more than once. This will grow as customers return." : "People who came back more than once"}
            />
          </div>
        ) : (
          <p className="text-helper">No metrics for this period yet. This will grow as customers return.</p>
        )}
      </PageSection>
    </div>
  );
}

export default function InsightsPage() {
  if (!hasClerk) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Business Summary</h1>
      <p className="mt-2 text-helper">
        Clerk authentication is not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to view insights.
      </p>
    </div>
  );
  }
  return <InsightsPageContent />;
}
