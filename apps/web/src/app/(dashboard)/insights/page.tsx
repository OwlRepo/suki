"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { useWorkspace } from "@/contexts/workspace-context";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MetricCard } from "@/components/ui/metric-card";
import { MetricGridSkeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { InsightsBarChart, InsightsPieChart } from "@/components/insights/insights-charts";

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
      <div className="space-y-6">
        <PageHeader
          title="Business Summary"
          plainLanguageDescription="Simple monthly numbers you can trust."
          whatThisPageIsFor="See how many first-time, returning, and total seen customers you had each month."
          whatToDoNext="Create a business in Setup first, then come back here to see your numbers."
        />
      </div>
    );
  }

  const monthName = new Date(year, month - 1).toLocaleString("default", { month: "long" });

  return (
    <div className="space-y-8 w-full">
      <PageHeader
        title="Business Summary"
        plainLanguageDescription="Simple monthly numbers you can trust."
        whatThisPageIsFor="See how many first-time, returning, and total seen customers you had this month."
        whatToDoNext="Check this month first. Use 'View past months' when you want to compare."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={String(month)}
              onValueChange={(v) => setMonth(parseInt(v, 10))}
            >
              <SelectTrigger className="min-h-[44px]" aria-label="Select month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {new Date(2000, m - 1).toLocaleString("default", { month: "long" })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {showYearSelector ? (
              <>
                <Select
                  value={String(year)}
                  onValueChange={(v) => setYear(parseInt(v, 10))}
                >
                  <SelectTrigger className="min-h-[44px]" aria-label="Select year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard
                label="First-time customers"
                value={metrics.newCustomers}
                suffix="People added this month on their first visit."
              />
              <MetricCard
                label="Customers seen this month"
                value={metrics.repeatVisits}
                suffix="Customers whose latest recorded visit is in this month."
              />
              <MetricCard
                label="Returning customers (2+ visits)"
                value={metrics.repeatCustomers}
                suffix="Customers with two or more total visits and a visit this month."
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Monthly breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <InsightsBarChart metrics={metrics} />
                </CardContent>
              </Card>
              {(metrics.newCustomers > 0 || metrics.repeatCustomers > 0) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Customer mix</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <InsightsPieChart metrics={metrics} />
                  </CardContent>
                </Card>
              )}
            </div>

            <p className="text-helper text-xs">
              Count method: Returning customers means 2+ total visits.
            </p>
          </div>
        ) : (
          <p className="text-helper">No metrics for this period yet. This will grow as customers return.</p>
        )}
      </PageSection>
    </div>
  );
}

export default function InsightsPage() {
  return <InsightsPageContent />;
}
