"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CalendarCheck,
  ChevronRight,
  ClipboardCheck,
  PlusCircle,
  Tag,
  UserPlus,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { IntakeQRBlock } from "@/components/intake-qr-block";
import { ListSkeleton, MetricGridSkeleton } from "@/components/ui/skeleton";
import { StatusBanner } from "@/components/ui/status-banner";
import { PrimaryPageAction } from "@/components/ui/primary-page-action";
import { useWorkspace } from "@/contexts/workspace-context";
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

type MetricItem = {
  label: string;
  value: string | number;
  suffix: string;
  icon: typeof Users;
  iconClassName: string;
  iconBgClassName: string;
};

function getActivityIcon(type: string) {
  const normalizedType = type.toLowerCase();

  if (normalizedType.includes("appointment")) {
    return {
      icon: CalendarCheck,
      iconClassName: "text-emerald-600",
      iconBgClassName: "bg-emerald-50",
    };
  }

  if (normalizedType.includes("promo")) {
    return {
      icon: Tag,
      iconClassName: "text-violet-600",
      iconBgClassName: "bg-violet-50",
    };
  }

  return {
    icon: UserPlus,
    iconClassName: "text-blue-600",
    iconBgClassName: "bg-blue-50",
  };
}

function DashboardPageContent() {
  const searchParams = useSearchParams();
  const { getToken } = useAuth();
  const { data: syncData } = useAuthSync();
  const workspace = useWorkspace();

  const showWelcome = searchParams?.get("welcome") === "1";

  const [summary, setSummary] = useState<Summary | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState(0);
  const [loading, setLoading] = useState(true);

  const businessId = workspace?.activeBusinessId ?? "";
  const businesses = workspace?.businesses ?? [];
  const organizationId = syncData?.organization?.id ?? null;

  useEffect(() => {
    if (organizationId) {
      recordOnboardingEvent("dashboard_viewed", organizationId);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) return;

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
  }, [organizationId, getToken]);

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
    if (!organizationId) return;

    (async () => {
      const token = await getToken();
      if (!token) return;

      try {
        const [usageRes, activityRes] = await Promise.all([
          apiRequest<Usage>(
            `/admin/usage${
              businessId ? `?businessId=${encodeURIComponent(businessId)}` : ""
            }`,
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
  }, [organizationId, businessId, getToken]);

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

  const summaryDisplay = summary ?? {
    businesses: 0,
    customers: 0,
    appointments: 0,
    promos: 0,
  };

  const nextStep = useMemo(() => {
    if (summaryDisplay.appointments === 0) {
      return {
        description:
          "Schedule your first appointment. Add customer details while booking.",
        href: "/appointments",
        buttonLabel: "Schedule your first appointment",
      };
    }

    return {
      description:
        "Open today's appointments and mark arriving customers with one tap.",
      href: "/appointments",
      buttonLabel: "Open appointments",
    };
  }, [summaryDisplay.appointments]);

  const metricItems: MetricItem[] = [
    {
      label: "Total customers",
      value: summaryDisplay.customers,
      suffix: "People currently saved in your customer list.",
      icon: Users,
      iconClassName: "text-blue-600",
      iconBgClassName: "bg-blue-50",
    },
    {
      label: "Visits this month",
      value: usage?.visitsThisMonth ?? metrics?.repeatVisits ?? "—",
      suffix: "How many customer visits were recorded this month.",
      icon: CalendarCheck,
      iconClassName: "text-emerald-600",
      iconBgClassName: "bg-emerald-50",
    },
    {
      label: "Upcoming appointments",
      value: upcomingAppointments,
      suffix: "Scheduled appointments still ahead.",
      icon: ClipboardCheck,
      iconClassName: "text-violet-600",
      iconBgClassName: "bg-violet-50",
    },
  ];

  return (
    <div className="w-full space-y-6 sm:space-y-8">
      <section>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Dashboard
        </h1>

        <p className="mt-3 text-base leading-7 text-slate-600 sm:text-lg">
          Welcome back. Here&apos;s what needs your attention today.
        </p>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="space-y-3 text-sm leading-6 text-slate-600 sm:text-base">
            <p>
              <span className="font-semibold text-slate-900">
                What this page is for:
              </span>{" "}
              Check today&apos;s priorities, then take one clear next step.
            </p>

            <p>
              <span className="font-semibold text-slate-900">
                What to do next:
              </span>{" "}
              {nextStep.buttonLabel}.
            </p>
          </div>
        </div>
      </section>

      {showWelcome ? (
        <StatusBanner
          variant="success"
          message="You're ready. Start by scheduling your first appointment."
          onDismiss={() => window.history.replaceState({}, "", "/dashboard")}
        />
      ) : null}

      {!workspace?.loading && businessId && businesses.length > 0 ? (
        <section className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-50/60 p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                <ClipboardCheck className="size-7" />
              </span>

              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-950">Next step</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600 sm:text-base">
                  {nextStep.description}
                </p>
              </div>
            </div>

            <ChevronRight className="hidden size-6 shrink-0 text-slate-400 sm:block" />
          </div>

          <PrimaryPageAction className="mt-5 w-full sm:w-auto">
            <Link href={nextStep.href} className="block w-full sm:w-auto">
              <Button size="lg" className="w-full gap-2 sm:w-auto">
                <PlusCircle className="size-5" />
                {nextStep.buttonLabel}
              </Button>
            </Link>
          </PrimaryPageAction>
        </section>
      ) : null}

      {businessId && businesses.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <IntakeQRBlock
            businessId={businessId}
            businessName={
              businesses.find((business) => business.id === businessId)?.name ??
              ""
            }
            heading="Let customers add themselves"
            helperText="Share this QR or link so customers can register without paperwork."
            showPrintButton
          />
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Metrics</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
              {usage?.month
                ? `Data for ${usage.month}. Each number includes a plain-language explanation.`
                : "Each number includes a plain-language explanation."}
            </p>
          </div>

          {usage?.month ? (
            <span className="text-sm font-medium text-slate-500">
              {usage.month}
            </span>
          ) : null}
        </div>

        <div className="mt-5">
          {loading || workspace?.loading ? (
            <MetricGridSkeleton count={3} />
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {metricItems.map(
                ({
                  label,
                  value,
                  suffix,
                  icon: Icon,
                  iconClassName,
                  iconBgClassName,
                }) => (
                  <article
                    key={label}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <span
                      className={`flex size-11 items-center justify-center rounded-2xl ${iconBgClassName} ${iconClassName}`}
                    >
                      <Icon className="size-5" />
                    </span>

                    <p className="mt-4 text-sm font-medium text-slate-600">
                      {label}
                    </p>
                    <p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
                      {value}
                    </p>
                    <p className="mt-2 text-sm leading-5 text-slate-600">
                      {suffix}
                    </p>
                  </article>
                ),
              )}
            </div>
          )}
        </div>
      </section>

      {loading || workspace?.loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-xl font-bold text-slate-950">Recent activity</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
            Latest customer, appointment, and promo changes
          </p>

          <ListSkeleton rowCount={5} className="mt-4" />
        </section>
      ) : activities.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-xl font-bold text-slate-950">Recent activity</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
            Latest customer, appointment, and promo changes
          </p>

          <ul
            className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200"
            role="list"
          >
            {activities.slice(0, 15).map((activity, index) => {
              const {
                icon: ActivityIcon,
                iconClassName,
                iconBgClassName,
              } = getActivityIcon(activity.type);

              return (
                <li
                  key={`${activity.type}-${activity.at}-${index}`}
                  className="flex min-w-0 items-start gap-3 bg-white px-3 py-3 sm:items-center sm:px-4"
                >
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full ${iconBgClassName} ${iconClassName}`}
                  >
                    <ActivityIcon className="size-5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-5 text-slate-900 sm:text-base">
                      {activity.description}
                    </p>

                    {activity.businessName ? (
                      <p className="mt-0.5 text-sm text-slate-500">
                        {activity.businessName}
                      </p>
                    ) : null}
                  </div>

                  <time className="shrink-0 text-xs text-slate-500 sm:text-sm">
                    {activity.at.slice(0, 10)}
                  </time>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {!loading && !workspace?.loading && summaryDisplay.businesses === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600 shadow-sm">
          Set up your first business to see metrics and manage customers.
        </p>
      ) : null}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading...</p>}>
      <DashboardPageContent />
    </Suspense>
  );
}
