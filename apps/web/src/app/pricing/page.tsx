"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useSession } from "@/hooks/use-session";
import { Card } from "@/components/ui/card";
import { StatusBanner } from "@/components/ui/status-banner";
import { SettingsSectionSkeleton } from "@/components/ui/skeleton";
import { BillingIntervalToggle } from "@/components/billing/billing-interval-toggle";
import { PlanComparisonGrid } from "@/components/billing/plan-comparison-grid";
import type { BillingInterval, BillingPlan } from "@/components/billing/types";

export default function PricingPage() {
  const { isSignedIn } = useSession();
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [annualCheckoutEnabled, setAnnualCheckoutEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await apiRequest<{
          plans: BillingPlan[];
          annualCheckoutEnabled?: boolean;
        }>("/billing/plans");
        if (!cancelled) {
          setPlans(result.plans);
          setAnnualCheckoutEnabled(result.annualCheckoutEnabled ?? false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load pricing.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Tyvera pricing</p>
          <h1 className="text-3xl font-semibold">Plans built around actual usage</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Staff-created appointments do not consume verified online-booking credits. SMS reminders and follow-ups use separate prepaid SMS credits.
          </p>
        </div>
        <BillingIntervalToggle value={interval} onChange={setInterval} />
      </header>

      {error ? <StatusBanner variant="error" message={error} /> : null}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <SettingsSectionSkeleton key={index} className="h-72" />
          ))}
        </div>
      ) : (
        <PlanComparisonGrid
          plans={plans}
          interval={interval}
          ctaHref={isSignedIn ? "/settings/billing" : "/sign-up"}
          annualCheckoutEnabled={annualCheckoutEnabled}
        />
      )}

      <Card className="border border-border p-5 text-sm text-muted-foreground">
        Verified online bookings are bookings submitted through your public booking page and confirmed using a one-time SMS code. Staff-created appointments do not consume verified online-booking credits.
      </Card>
    </main>
  );
}
