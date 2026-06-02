"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { SettingsSectionSkeleton } from "@/components/ui/skeleton";
import { StatusBanner } from "@/components/ui/status-banner";
import { CurrentPlanCard } from "@/components/billing/current-plan-card";
import { UsageMeterCard } from "@/components/billing/usage-meter-card";
import { BillingStatusBanner } from "@/components/billing/billing-status-banner";
import { CheckoutSyncBanner } from "@/components/billing/checkout-sync-banner";
import { AddonPackGrid } from "@/components/billing/addon-pack-grid";
import { PlanComparisonGrid } from "@/components/billing/plan-comparison-grid";
import { BillingIntervalToggle } from "@/components/billing/billing-interval-toggle";
import type { BillingInterval, BillingPlan } from "@/components/billing/types";

type BillingStatusResponse = {
  planType: string;
  billingStatus: string;
  billingInterval: BillingInterval | null;
  renewsAt: string | null;
  endsAt: string | null;
  verifiedOnlineBookingCredits?: {
    included: number;
    addon: number;
    used: number;
    remaining: number;
  };
  subscription: null | Record<string, unknown>;
};

export default function BillingSettingsPage() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const [billing, setBilling] = useState<BillingStatusResponse | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncTimedOut, setSyncTimedOut] = useState(false);

  const addonGroups = useMemo(
    () => ({
      otp: [
        { sku: "online-booking-topup-10", label: "10 verified bookings", pricePhp: 299 },
        { sku: "online-booking-topup-25", label: "25 verified bookings", pricePhp: 699 },
      ],
      sms: [
        { sku: "sms-segment-topup-25", label: "25 SMS segments", pricePhp: 599 },
        { sku: "sms-segment-topup-50", label: "50 SMS segments", pricePhp: 1099 },
      ],
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const token = await getToken();
        if (!token) return;
        const [billingData, plansData] = await Promise.all([
          apiRequest<BillingStatusResponse>("/billing/status", { token }),
          apiRequest<{ plans: BillingPlan[] }>("/billing/plans"),
        ]);
        if (cancelled) return;
        setBilling(billingData);
        setPlans(plansData.plans);
        setBillingInterval(billingData.billingInterval ?? "monthly");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load billing.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  useEffect(() => {
    if (searchParams?.get("checkout") !== "success") return;

    let attempts = 0;
    let cancelled = false;
    setSyncing(true);
    setSyncTimedOut(false);

    const timer = setInterval(async () => {
      attempts += 1;
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const next = await apiRequest<BillingStatusResponse>("/billing/status", { token });
        if (cancelled) return;
        setBilling(next);
        if (next.planType !== "free") {
          clearInterval(timer);
          setSyncing(false);
        }
      } catch {
        // keep polling for a short bounded window
      }

      if (attempts >= 15) {
        clearInterval(timer);
        if (!cancelled) {
          setSyncTimedOut(true);
          setSyncing(false);
        }
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [getToken, searchParams]);

  async function startPlanCheckout(planType: "starter" | "growth" | "pro") {
    setActionLoading(planType);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const result = await apiRequest<{ checkoutUrl: string }>("/billing/checkout", {
        method: "POST",
        token,
        body: JSON.stringify({ planType, billingInterval: interval }),
      });
      window.location.href = result.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout is temporarily unavailable. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  async function startAddonCheckout(sku: string) {
    setActionLoading(sku);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const result = await apiRequest<{ checkoutUrl: string }>("/billing/addons/checkout", {
        method: "POST",
        token,
        body: JSON.stringify({ sku }),
      });
      window.location.href = result.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout is temporarily unavailable. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4">
        <SettingsSectionSkeleton className="h-36" />
        <div className="grid gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <SettingsSectionSkeleton key={index} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <CheckoutSyncBanner syncing={syncing} timedOut={syncTimedOut} />
      {billing ? <BillingStatusBanner billingStatus={billing.billingStatus} /> : null}
      {error ? <StatusBanner variant="error" message={error} /> : null}

      <CurrentPlanCard
        planLabel={billing?.planType ? billing.planType.toUpperCase() : "FREE"}
        statusLabel={billing?.billingStatus ?? "free_active"}
        renewalLabel={
          billing?.renewsAt
            ? `Renews on ${new Date(billing.renewsAt).toLocaleDateString("en-PH")}`
            : billing?.endsAt
              ? `Access ends on ${new Date(billing.endsAt).toLocaleDateString("en-PH")}`
              : "No active paid subscription yet."
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <UsageMeterCard
          label="Verified online bookings"
          included={billing?.verifiedOnlineBookingCredits?.included ?? 0}
          addon={billing?.verifiedOnlineBookingCredits?.addon ?? 0}
          used={billing?.verifiedOnlineBookingCredits?.used ?? 0}
          remaining={billing?.verifiedOnlineBookingCredits?.remaining ?? 0}
          helper="Staff-created appointments do not consume these credits."
        />
        <UsageMeterCard
          label="SMS segments"
          included={0}
          used={0}
          remaining={0}
          helper="SMS reminders and follow-ups use separate prepaid segment credits."
        />
        <UsageMeterCard
          label="Email messages"
          included={0}
          used={0}
          remaining={0}
          helper="Included monthly email allowance follows your current plan."
        />
        <UsageMeterCard
          label="AI requests"
          included={0}
          used={0}
          remaining={0}
          helper="AI-assisted writing is only included on Growth and Pro."
        />
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Upgrade or change plan</h2>
            <p className="text-sm text-muted-foreground">
              We activate paid access only after the signed Lemon Squeezy webhook has been reconciled.
            </p>
          </div>
          <BillingIntervalToggle value={interval} onChange={setBillingInterval} />
        </div>
        <PlanComparisonGrid
          plans={plans}
          interval={interval}
          ctaHref="/settings/billing"
        />
        <div className="flex flex-wrap gap-3">
          {(["starter", "growth", "pro"] as const).map((planType) => (
            <Button
              key={planType}
              type="button"
              disabled={actionLoading === planType}
              aria-label={`Upgrade to ${planType}`}
              onClick={() => startPlanCheckout(planType)}
            >
              {actionLoading === planType ? "Preparing checkout..." : `Upgrade to ${planType}`}
            </Button>
          ))}
        </div>
      </section>

      <AddonPackGrid
        title="Verified booking top-ups"
        items={addonGroups.otp}
        loadingKey={actionLoading}
        onCheckout={startAddonCheckout}
      />

      <AddonPackGrid
        title="SMS segment top-ups"
        items={addonGroups.sms}
        loadingKey={actionLoading}
        onCheckout={startAddonCheckout}
      />
    </div>
  );
}
