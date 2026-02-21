"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { hasClerk } from "@/lib/clerk";
import { IntakeQRBlock } from "@/components/intake-qr-block";
import {
  PracticeDayBanner,
  OnboardingGuidance,
  OnboardingChecklist,
  TooltipBadge,
} from "@/components/onboarding";
import { useOnboarding } from "@/contexts/onboarding-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { ONBOARDING_STEPS } from "@/lib/onboarding";
import { recordOnboardingEvent } from "@/lib/onboarding-metrics";

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

interface Usage {
  activeCustomers: number;
  newCustomersThisMonth: number;
  visitsThisMonth: number;
  promosSentThisMonth: number;
  month: string;
}

interface Activity {
  type: string;
  description: string;
  at: string;
  businessName?: string;
}

function DashboardPageContent() {
  const { getToken } = useAuth();
  const { data: syncData } = useAuthSync();
  const onboarding = useOnboarding();
  const workspace = useWorkspace();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const businessId = workspace?.activeBusinessId ?? "";
  const businesses = workspace?.businesses ?? [];

  useEffect(() => {
    if (syncData) {
      recordOnboardingEvent("dashboard_viewed", syncData.organization?.id ?? null);
    }
  }, [syncData]);

  useEffect(() => {
    if (!syncData) return;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const summaryRes = await apiRequest<Summary>("/admin/summary", { token });
        setSummary(summaryRes);
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
      try {
        const res = await apiRequest<{ metrics: Metrics }>(
          `/insights/monthly?businessId=${businessId}&year=${now.getFullYear()}&month=${now.getMonth() + 1}`,
          { token },
        );
        setMetrics(res.metrics);
      } catch {
        setMetrics(null);
      }
    })();
  }, [businessId, getToken]);

  useEffect(() => {
    if (!syncData) return;
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const [usageRes, activityRes] = await Promise.all([
          apiRequest<Usage>(`/admin/usage${businessId ? `?businessId=${businessId}` : ""}`, { token }),
          apiRequest<{ activities: Activity[] }>("/admin/activity?limit=15", { token }),
        ]);
        setUsage(usageRes);
        setActivities(activityRes.activities ?? []);
      } catch {
        setUsage(null);
        setActivities([]);
      }
    })();
  }, [syncData, businessId, getToken]);

  if (loading || workspace?.loading) return <p className="text-muted-foreground">Loading...</p>;

  const s = summary ?? { businesses: 0, customers: 0, appointments: 0, promos: 0 };
  const showPracticeData = onboarding?.practiceMode && !onboarding.onboardingCompletedAt;
  const summaryDisplay = showPracticeData
    ? { businesses: 1, customers: 8, appointments: 5, promos: 3 }
    : s;
  const highlightFirstCard =
    onboarding?.currentStep === ONBOARDING_STEPS.firstDashboard && !onboarding.onboardingCompletedAt;

  return (
    <div className="space-y-8">
      <div>
        <PracticeDayBanner />
        <OnboardingChecklist />
        <OnboardingGuidance
          step={ONBOARDING_STEPS.firstDashboard}
          screen="dashboard"
          onComplete={() => {}}
        />
      </div>
      <div>
      <h1 className="text-2xl font-semibold text-foreground">
        <TooltipBadge screen="dashboard">Dashboard</TooltipBadge>
      </h1>
      <p className="mt-2 text-muted-foreground">
        Overview of your business and engagement metrics.
      </p>

      {businessId && businesses.length > 0 && (
        <div className="mt-8">
          <IntakeQRBlock
            businessId={businessId}
            businessName={businesses.find((b) => b.id === businessId)?.name ?? ""}
          />
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-4">
        <Link href="/setup">
          <Button>Business setup</Button>
        </Link>
        <Link
          href="/customers"
          onClick={() => {
            if (highlightFirstCard && onboarding) {
              onboarding.advanceStep();
            }
          }}
        >
          <Button
            variant={highlightFirstCard ? "default" : "outline"}
            className={highlightFirstCard ? "ring-2 ring-primary ring-offset-2" : ""}
          >
            Add first customer
          </Button>
        </Link>
        <Link href="/appointments">
          <Button variant="outline">Appointments</Button>
        </Link>
        <Link href="/promos">
          <Button variant="outline">Promos</Button>
        </Link>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Businesses</p>
          <p className="mt-1 text-2xl font-semibold">{summaryDisplay.businesses}</p>
          {showPracticeData && (
            <span className="mt-1 inline-block text-xs text-amber-600 dark:text-amber-400">
              Practice Sample
            </span>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Customers</p>
          <p className="mt-1 text-2xl font-semibold">{summaryDisplay.customers}</p>
          {showPracticeData && (
            <span className="mt-1 inline-block text-xs text-amber-600 dark:text-amber-400">
              Practice Sample
            </span>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Appointments</p>
          <p className="mt-1 text-2xl font-semibold">{summaryDisplay.appointments}</p>
          {showPracticeData && (
            <span className="mt-1 inline-block text-xs text-amber-600 dark:text-amber-400">
              Practice Sample
            </span>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Promos</p>
          <p className="mt-1 text-2xl font-semibold">{summaryDisplay.promos}</p>
          {showPracticeData && (
            <span className="mt-1 inline-block text-xs text-amber-600 dark:text-amber-400">
              Practice Sample
            </span>
          )}
        </div>
      </div>

      {(usage || metrics) && (
        <div className="mt-10">
          <h2 className="text-base font-medium text-foreground">This month</h2>
          <p className="text-sm text-muted-foreground">
            {usage?.month ? `Data for ${usage.month}` : "Monthly usage"}
          </p>
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Active customers</p>
              <p className="mt-1 text-xl font-semibold">{usage?.activeCustomers ?? metrics?.repeatCustomers ?? "—"}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">New customers</p>
              <p className="mt-1 text-xl font-semibold">{usage?.newCustomersThisMonth ?? metrics?.newCustomers ?? "—"}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Visits</p>
              <p className="mt-1 text-xl font-semibold">{usage?.visitsThisMonth ?? metrics?.repeatVisits ?? "—"}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Promos sent</p>
              <p className="mt-1 text-xl font-semibold">{usage?.promosSentThisMonth ?? "—"}</p>
            </div>
          </div>
        </div>
      )}

      {activities.length > 0 && (
        <div className="mt-10">
          <h2 className="text-base font-medium text-foreground">Recent activity</h2>
          <p className="text-sm text-muted-foreground">
            Latest customer, appointment, and promo changes
          </p>
          <ul className="mt-3 space-y-2" role="list">
            {activities.slice(0, 15).map((a, i) => (
              <li
                key={`${a.type}-${a.at}-${i}`}
                className="flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2 text-base"
              >
                <span className="shrink-0 text-muted-foreground" aria-hidden>
                  {a.at.slice(0, 10)}
                </span>
                <span>{a.description}</span>
                {a.businessName && (
                  <span className="shrink-0 text-sm text-muted-foreground">({a.businessName})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {s.businesses === 0 && (
        <p className="mt-6 text-muted-foreground">
          Set up your first business to see metrics and manage customers.
        </p>
      )}
      </div>
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
