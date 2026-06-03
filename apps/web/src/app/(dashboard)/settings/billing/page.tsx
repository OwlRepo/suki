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
  readOnly?: boolean;
  billingInterval: BillingInterval | null;
  renewsAt: string | null;
  endsAt: string | null;
  cancellationPending?: boolean;
  scheduledPlanType?: string | null;
  scheduledBillingInterval?: BillingInterval | null;
  scheduledChangeEffectiveAt?: string | null;
  ownerWarnings?: Array<{
    code: string;
    severity: "info" | "warning" | "error";
    message: string;
  }>;
  verifiedOnlineBookingCredits?: {
    included: number;
    addon: number;
    used: number;
    total: number;
    remaining: number;
    pausedReason?: string | null;
  };
  smsSegmentCredits?: {
    included: number;
    addon: number;
    used: number;
    total: number;
    remaining: number;
    pausedReason?: string | null;
  };
  emailCredits?: {
    included: number;
    used: number;
    total: number;
    remaining: number;
  };
  aiRequests?: {
    included: number;
    used: number;
    total: number;
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    setSuccessMessage(null);
    try {
      const token = await getToken();
      if (!token) return;
      const isPaid = !!billing?.subscription && billing.planType !== "free";

      if (isPaid) {
        await apiRequest("/billing/change-plan", {
          method: "POST",
          token,
          body: JSON.stringify({ planType, billingInterval: interval }),
        });
        setSuccessMessage("Plan change submitted. We’ll update your account after webhook sync completes.");
        const next = await apiRequest<BillingStatusResponse>("/billing/status", { token });
        setBilling(next);
        return;
      }

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
    setSuccessMessage(null);
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

  async function openCustomerPortal() {
    setActionLoading("customer-portal");
    setError(null);
    setSuccessMessage(null);
    try {
      const token = await getToken();
      if (!token) return;
      const result = await apiRequest<{ url: string }>("/billing/customer-portal", {
        method: "POST",
        token,
      });
      if (typeof window !== "undefined") {
        window.location.href = result.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Billing portal is temporarily unavailable. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  async function cancelSubscription() {
    setActionLoading("cancel");
    setError(null);
    setSuccessMessage(null);
    try {
      const token = await getToken();
      if (!token) return;
      await apiRequest("/billing/cancel", {
        method: "POST",
        token,
      });
      const next = await apiRequest<BillingStatusResponse>("/billing/status", { token });
      setBilling(next);
      setSuccessMessage("Cancellation scheduled. Your current access remains active until the billing boundary.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to cancel subscription right now.");
    } finally {
      setActionLoading(null);
    }
  }

  async function resumeSubscription() {
    setActionLoading("resume");
    setError(null);
    setSuccessMessage(null);
    try {
      const token = await getToken();
      if (!token) return;
      await apiRequest("/billing/resume", {
        method: "POST",
        token,
      });
      const next = await apiRequest<BillingStatusResponse>("/billing/status", { token });
      setBilling(next);
      setSuccessMessage("Subscription resume requested. We’ll reflect the final state after webhook reconciliation.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resume subscription right now.");
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
      <CheckoutSyncBanner
        syncing={syncing}
        timedOut={syncTimedOut}
        delayedSyncWarning={
          billing?.ownerWarnings?.find((warning) => warning.code === "delayed_webhook_sync")?.message ?? null
        }
      />
      {billing ? (
        <BillingStatusBanner
          billingStatus={billing.billingStatus}
          cancellationPending={billing.cancellationPending}
          scheduledPlanType={billing.scheduledPlanType}
          scheduledChangeEffectiveAt={billing.scheduledChangeEffectiveAt}
        />
      ) : null}
      {billing?.scheduledPlanType ? (
        <StatusBanner
          variant="info"
          message={`Your plan is scheduled to move to ${billing.scheduledPlanType} on ${new Date(
            billing.scheduledChangeEffectiveAt ?? billing.renewsAt ?? Date.now(),
          ).toLocaleDateString("en-PH")}.`}
        />
      ) : null}
      {billing?.readOnly ? (
        <StatusBanner
          variant="info"
          message="Read-only access. Only workspace owners can change plans, open checkout, or manage billing."
        />
      ) : null}
      {billing?.ownerWarnings?.map((warning) => (
        warning.code === "delayed_webhook_sync" ? null : (
          <StatusBanner
            key={`${warning.code}-${warning.message}`}
            variant={warning.severity === "error" ? "error" : warning.severity}
            message={warning.message}
          />
        )
      ))}
      {successMessage ? <StatusBanner variant="success" message={successMessage} /> : null}
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
      {billing && !billing.readOnly ? (
        <div className="flex flex-wrap gap-3">
          {billing.subscription ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={actionLoading === "customer-portal"}
                aria-label="Manage billing"
                onClick={openCustomerPortal}
              >
                {actionLoading === "customer-portal" ? "Opening portal..." : "Manage billing"}
              </Button>
              {billing.cancellationPending || billing.billingStatus === "subscription_cancelled" ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={actionLoading === "resume"}
                  aria-label="Resume subscription"
                  onClick={resumeSubscription}
                >
                  {actionLoading === "resume" ? "Resuming..." : "Resume subscription"}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={actionLoading === "cancel"}
                  aria-label="Cancel subscription"
                  onClick={cancelSubscription}
                >
                  {actionLoading === "cancel" ? "Cancelling..." : "Cancel subscription"}
                </Button>
              )}
            </>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-4">
        <UsageMeterCard
          label="Verified online bookings"
          included={billing?.verifiedOnlineBookingCredits?.included ?? 0}
          addon={billing?.verifiedOnlineBookingCredits?.addon ?? 0}
          used={billing?.verifiedOnlineBookingCredits?.used ?? 0}
          remaining={billing?.verifiedOnlineBookingCredits?.remaining ?? 0}
          pausedReason={billing?.verifiedOnlineBookingCredits?.pausedReason ?? null}
          helper="Staff-created appointments do not consume these credits."
        />
        <UsageMeterCard
          label="SMS segments"
          included={billing?.smsSegmentCredits?.included ?? 0}
          addon={billing?.smsSegmentCredits?.addon ?? 0}
          used={billing?.smsSegmentCredits?.used ?? 0}
          remaining={billing?.smsSegmentCredits?.remaining ?? 0}
          pausedReason={billing?.smsSegmentCredits?.pausedReason ?? null}
          helper="SMS reminders and follow-ups use separate prepaid segment credits."
        />
        <UsageMeterCard
          label="Email messages"
          included={billing?.emailCredits?.included ?? 0}
          used={billing?.emailCredits?.used ?? 0}
          remaining={billing?.emailCredits?.remaining ?? 0}
          helper="Included monthly email allowance follows your current plan."
        />
        <UsageMeterCard
          label="AI requests"
          included={billing?.aiRequests?.included ?? 0}
          used={billing?.aiRequests?.used ?? 0}
          remaining={billing?.aiRequests?.remaining ?? 0}
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
        {billing?.readOnly ? null : (
          <div className="flex flex-wrap gap-3">
            {(["starter", "growth", "pro"] as const).map((planType) => (
              <Button
                key={planType}
                type="button"
                disabled={actionLoading === planType || billing?.planType === planType}
                aria-label={
                  billing?.subscription
                    ? billing?.planType === planType
                      ? `${planType} current plan`
                      : `Switch to ${planType}`
                    : `Upgrade to ${planType}`
                }
                onClick={() => startPlanCheckout(planType)}
              >
                {actionLoading === planType
                  ? billing?.subscription
                    ? "Submitting..."
                    : "Preparing checkout..."
                  : billing?.planType === planType
                    ? `${planType} current`
                    : billing?.subscription
                      ? `Switch to ${planType}`
                      : `Upgrade to ${planType}`}
              </Button>
            ))}
          </div>
        )}
      </section>

      {billing?.readOnly ? null : (
        <AddonPackGrid
          title="Verified booking top-ups"
          items={addonGroups.otp}
          loadingKey={actionLoading}
          onCheckout={startAddonCheckout}
        />
      )}

      {billing?.readOnly ? null : (
        <AddonPackGrid
          title="SMS segment top-ups"
          items={addonGroups.sms}
          loadingKey={actionLoading}
          onCheckout={startAddonCheckout}
        />
      )}
    </div>
  );
}
