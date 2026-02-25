"use client";

import Link from "next/link";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { useBillingStatus } from "@/hooks/use-billing-status";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { StatusBanner } from "@/components/ui/status-banner";

const REQUEST_ACCESS_URL =
  process.env.NEXT_PUBLIC_REQUEST_ACCESS_URL ||
  "mailto:support@suki.com?subject=Request%20access%20to%20Suki";

export function TrialBanner() {
  const { data: syncData } = useAuthSync();
  const organizationId = syncData?.organization?.id ?? null;
  const { billing, loading, readOnly, daysRemaining } = useBillingStatus(!!organizationId);
  const flags = useFeatureFlags();

  if (loading || !billing) return null;

  // Expired / past due / suspended: show contact message
  if (readOnly) {
    const message = flags.self_serve_billing_enabled ? (
      <>
        Messages paused until billing is fixed.{" "}
        <Link href="/settings#billing" className="underline font-medium">
          Update your payment
        </Link>{" "}
        to resume.
      </>
    ) : (
      <>
        Access paused.{" "}
        <a href={REQUEST_ACCESS_URL} className="underline font-medium">
          Contact us
        </a>{" "}
        to resume.
      </>
    );
    return (
      <div className="mb-4">
        <StatusBanner variant="error" message={message} />
      </div>
    );
  }

  // Founder-led trial with days remaining (only when we have daysRemaining from API)
  if (daysRemaining != null && !flags.self_serve_billing_enabled) {
    const expiringSoon = daysRemaining <= 7;
    return (
      <div className="mb-4">
        <StatusBanner
          variant={expiringSoon ? "warning" : "info"}
          message={
            expiringSoon ? (
              <>
                Trial expires in {daysRemaining} day{daysRemaining === 1 ? "" : "s"}.{" "}
                <a href={REQUEST_ACCESS_URL} className="underline font-medium">
                  Contact us
                </a>{" "}
                to continue.
              </>
            ) : (
              <>
                Trial: {daysRemaining} day{daysRemaining === 1 ? "" : "s"} remaining.{" "}
                <Link href="/settings#billing" className="underline font-medium">
                  View billing
                </Link>
              </>
            )
          }
        />
      </div>
    );
  }

  return null;
}
