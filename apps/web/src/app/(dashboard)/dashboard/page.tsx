"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { hasClerk } from "@/lib/clerk";

interface Summary {
  businesses: number;
  customers: number;
  appointments: number;
  promos: number;
}

interface Metrics {
  year: number;
  month: number;
  newCustomers: number;
  repeatCustomers: number;
  repeatVisits: number;
}

function DashboardPageContent() {
  const { getToken } = useAuth();
  const { data: syncData } = useAuthSync();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [businessId, setBusinessId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!syncData) return;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const [summaryRes, businessesRes] = await Promise.all([
          apiRequest<Summary>("/admin/summary", { token }),
          apiRequest<{ businesses: { id: string; name: string }[] }>("/businesses", { token }),
        ]);
        setSummary(summaryRes);
        if (businessesRes.businesses.length) {
          setBusinessId(businessesRes.businesses[0].id);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [syncData, getToken]);

  useEffect(() => {
    if (!businessId) return;
    (async () => {
      const token = await getToken();
      if (!token) return;
      const now = new Date();
      const res = await apiRequest<{ metrics: Metrics }>(
        `/insights/monthly?businessId=${businessId}&year=${now.getFullYear()}&month=${now.getMonth() + 1}`,
        { token },
      );
      setMetrics(res.metrics);
    })();
  }, [businessId, getToken]);

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  const s = summary ?? { businesses: 0, customers: 0, appointments: 0, promos: 0 };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Overview of your business and engagement metrics.
      </p>

      <div className="mt-6 flex flex-wrap gap-4">
        <Link href="/setup">
          <Button>Business setup</Button>
        </Link>
        <Link href="/customers">
          <Button variant="outline">Customers</Button>
        </Link>
        <Link href="/appointments">
          <Button variant="outline">Appointments</Button>
        </Link>
        <Link href="/promos">
          <Button variant="outline">Promos</Button>
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Businesses</p>
          <p className="mt-1 text-2xl font-semibold">{s.businesses}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Customers</p>
          <p className="mt-1 text-2xl font-semibold">{s.customers}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Appointments</p>
          <p className="mt-1 text-2xl font-semibold">{s.appointments}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Promos</p>
          <p className="mt-1 text-2xl font-semibold">{s.promos}</p>
        </div>
      </div>

      {metrics && (
        <div className="mt-8">
          <h2 className="text-lg font-medium">This month</h2>
          <div className="mt-2 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">New customers</p>
              <p className="mt-1 text-xl font-semibold">{metrics.newCustomers}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Repeat visits</p>
              <p className="mt-1 text-xl font-semibold">{metrics.repeatVisits}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Repeat customers</p>
              <p className="mt-1 text-xl font-semibold">{metrics.repeatCustomers}</p>
            </div>
          </div>
        </div>
      )}

      {s.businesses === 0 && (
        <p className="mt-6 text-muted-foreground">
          Set up your first business to see metrics and manage customers.
        </p>
      )}
    </div>
  );
}

export default function DashboardPage() {
  if (!hasClerk) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Clerk authentication is not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to view your dashboard.
        </p>
      </div>
    );
  }
  return <DashboardPageContent />;
}
