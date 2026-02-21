"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { hasClerk } from "@/lib/clerk";
import { IntakeQRBlock } from "@/components/intake-qr-block";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBanner } from "@/components/ui/status-banner";
import { PrimaryPageAction } from "@/components/ui/primary-page-action";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
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
  upcomingAppointments?: number;
}

interface Activity {
  type: string;
  description: string;
  at: string;
  businessName?: string;
}

function DashboardPageContent() {
  const searchParams = useSearchParams();
  const { getToken } = useAuth();
  const { data: syncData } = useAuthSync();
  const onboarding = useOnboarding();
  const workspace = useWorkspace();
  const showWelcome = searchParams?.get("welcome") === "1";
  const [summary, setSummary] = useState<Summary | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const businessId = workspace?.activeBusinessId ?? "";
  const businesses = workspace?.businesses ?? [];

  useEffect(() => {
    if (syncData) {
      recordOnboardingEvent(
        "dashboard_viewed",
        syncData.organization?.id ?? null,
      );
    }
  }, [syncData]);

  useEffect(() => {
    if (!syncData) return;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const summaryRes = await apiRequest<Summary>("/admin/summary", {
          token,
        });
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
          apiRequest<Usage>(
            `/admin/usage${businessId ? `?businessId=${encodeURIComponent(businessId)}` : ""}`,
            { token },
          ),
          apiRequest<{ activities: Activity[] }>("/admin/activity?limit=15", {
            token,
          }),
        ]);
        setUsage(usageRes);
        setActivities(activityRes.activities ?? []);
      } catch {
        setUsage(null);
        setActivities([]);
      }
    })();
  }, [syncData, businessId, getToken]);

  // upcomingAppointments comes from usage when businessId is set; otherwise fetch separately
  useEffect(() => {
    if (usage?.upcomingAppointments !== undefined) {
      setUpcomingAppointments(usage.upcomingAppointments);
      return;
    }
    if (!businessId) return;
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const from = new Date();
        from.setHours(0, 0, 0, 0);
        const res = await apiRequest<{ appointments: unknown[] }>(
          `/appointments?businessId=${businessId}&from=${from.toISOString()}`,
          { token },
        );
        setUpcomingAppointments(res.appointments?.length ?? 0);
      } catch {
        setUpcomingAppointments(0);
      }
    })();
  }, [businessId, getToken, usage?.upcomingAppointments]);

  if (loading || workspace?.loading)
    return <p className="text-muted-foreground">Loading...</p>;

  const s = summary ?? {
    businesses: 0,
    customers: 0,
    appointments: 0,
    promos: 0,
  };
  const showPracticeData =
    onboarding?.practiceMode && !onboarding.onboardingCompletedAt;
  const summaryDisplay = showPracticeData
    ? { businesses: 1, customers: 8, appointments: 5, promos: 3 }
    : s;
  const highlightFirstCard =
    onboarding?.currentStep === ONBOARDING_STEPS.firstDashboard &&
    !onboarding.onboardingCompletedAt;

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
      <div className="space-y-8">
        <PageHeader
          title={<TooltipBadge screen="dashboard">Dashboard</TooltipBadge>}
          description="Welcome back. Here's what needs your attention today."
        />

        {showWelcome && (
          <StatusBanner
            variant="success"
            message="You're ready. Start by adding your first customer."
            onDismiss={() => window.history.replaceState({}, "", "/dashboard")}
          />
        )}

        {businessId && businesses.length > 0 && (
          <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-5">
            <h2 className="text-base font-medium text-foreground">Next step</h2>
            <p className="mt-1 text-helper">
              {summaryDisplay.customers === 0
                ? "Add your first customer to get started."
                : summaryDisplay.appointments === 0
                  ? "Schedule your first appointment to plan your day."
                  : "Record a customer visit to keep your list up to date."}
            </p>
            <PrimaryPageAction className="mt-4">
              {summaryDisplay.customers === 0 ? (
                <Link
                  href="/customers"
                  onClick={() => {
                    if (highlightFirstCard && onboarding)
                      onboarding.advanceStep();
                  }}
                >
                  <Button
                    variant={highlightFirstCard ? "default" : "default"}
                    className={
                      highlightFirstCard
                        ? "ring-2 ring-primary ring-offset-2"
                        : ""
                    }
                  >
                    Add your first customer
                  </Button>
                </Link>
              ) : summaryDisplay.appointments === 0 ? (
                <Link href="/appointments">
                  <Button>Schedule your first appointment</Button>
                </Link>
              ) : (
                <Link href="/customers">
                  <Button>Record a customer visit</Button>
                </Link>
              )}
            </PrimaryPageAction>
          </div>
        )}

        {businessId && businesses.length > 0 && (
          <PageSection>
            <IntakeQRBlock
              businessId={businessId}
              businessName={
                businesses.find((b) => b.id === businessId)?.name ?? ""
              }
              heading="Let customers add themselves"
              helperText="Share this QR or link so customers can register without paperwork."
              showPrintButton
            />
          </PageSection>
        )}

        <div className="flex flex-wrap gap-2">
          <Link href="/setup">
            <Button variant="outline" size="sm">
              Business setup
            </Button>
          </Link>
          <Link href="/customers">
            <Button variant="outline" size="sm">
              Customers
            </Button>
          </Link>
          <Link href="/appointments">
            <Button variant="outline" size="sm">
              Appointments
            </Button>
          </Link>
          <Link href="/promos">
            <Button variant="outline" size="sm">
              Promos
            </Button>
          </Link>
        </div>

        <PageSection
          title="Metrics"
          description={usage?.month ? `Data for ${usage.month}` : undefined}
        >
          <div className="grid gap-6 sm:grid-cols-3">
            <MetricCard
              label="Total customers"
              value={summaryDisplay.customers}
              suffix={showPracticeData ? "Practice Sample" : undefined}
            />
            <MetricCard
              label="Visits this month"
              value={usage?.visitsThisMonth ?? metrics?.repeatVisits ?? "—"}
            />
            <MetricCard
              label="Upcoming appointments"
              value={
                showPracticeData
                  ? summaryDisplay.appointments
                  : upcomingAppointments
              }
              suffix={showPracticeData ? "Practice Sample" : undefined}
            />
          </div>
        </PageSection>

        {activities.length > 0 && (
          <PageSection
            title="Recent activity"
            description="Latest customer, appointment, and promo changes"
          >
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
                    <span className="shrink-0 text-sm text-muted-foreground">
                      ({a.businessName})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </PageSection>
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
          Clerk authentication is not configured. Set
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to view your dashboard.
        </p>
      </div>
    );
  }
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading...</p>}>
      <DashboardPageContent />
    </Suspense>
  );
}
