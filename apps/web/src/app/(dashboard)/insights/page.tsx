"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { hasClerk } from "@/lib/clerk";

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
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<string>("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!syncData) return;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await apiRequest<{ businesses: Business[] }>("/businesses", { token });
        setBusinesses(res.businesses);
        if (res.businesses.length) setSelectedBiz(res.businesses[0].id);
      } finally {
        setLoading(false);
      }
    })();
  }, [syncData, getToken]);

  useEffect(() => {
    if (!selectedBiz) return;
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
      }
    })();
  }, [selectedBiz, year, month, getToken]);

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (!businesses.length) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Insights</h1>
        <p className="mt-2 text-muted-foreground">Create a business in Setup first.</p>
      </div>
    );
  }

  const monthName = new Date(year, month - 1).toLocaleString("default", { month: "long" });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Insights</h1>
        <select
          value={selectedBiz}
          onChange={(e) => setSelectedBiz(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => setMonth(parseInt(e.target.value, 10))}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {new Date(2000, m - 1).toLocaleString("default", { month: "long" })}
            </option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value, 10))}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-medium">{monthName} {year}</h2>
        {metrics ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">New customers</p>
              <p className="mt-1 text-2xl font-semibold">{metrics.newCustomers}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Repeat visits</p>
              <p className="mt-1 text-2xl font-semibold">{metrics.repeatVisits}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Repeat customers</p>
              <p className="mt-1 text-2xl font-semibold">{metrics.repeatCustomers}</p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-muted-foreground">No metrics for this period.</p>
        )}
      </div>
    </div>
  );
}

export default function InsightsPage() {
  if (!hasClerk) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Insights</h1>
        <p className="mt-2 text-muted-foreground">
          Clerk authentication is not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to view insights.
        </p>
      </div>
    );
  }
  return <InsightsPageContent />;
}
