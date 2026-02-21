"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  useOnboardingProgress,
  ONBOARDING_COMPLETE_STEP,
} from "@/hooks/use-onboarding-progress";
import { useAccountSummary } from "@/hooks/use-account-freshness";
import { useWorkspace } from "@/contexts/workspace-context";
import { isPathAllowedForStep } from "@/lib/onboarding";
import { OnboardingBanner } from "./onboarding-banner";
import { useAuthSync } from "@/hooks/use-auth-sync";

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { progress, loading, isComplete, markComplete, fetchProgress } = useOnboardingProgress();
  const { summary } = useAccountSummary();
  const workspace = useWorkspace();
  const { data: syncData, loading: syncLoading, error: syncError, retry: retrySync } = useAuthSync();
  const backfillAttempted = useRef(false);
  const hasRetriedProgressRef = useRef(false);
  const organizationId = syncData?.organization?.id ?? null;

  const businesses = workspace?.businesses ?? [];

  const isLegacyUser =
    !loading &&
    progress &&
    progress.currentStep < ONBOARDING_COMPLETE_STEP &&
    progress.completedSteps.length === 0 &&
    businesses.length > 0 &&
    (summary ? summary.customers > 2 || summary.appointments > 0 : false);

  useEffect(() => {
    if (isLegacyUser && !backfillAttempted.current) {
      backfillAttempted.current = true;
      markComplete();
    }
  }, [isLegacyUser, markComplete]);

  useEffect(() => {
    if (!syncLoading && organizationId && !loading && !progress && !hasRetriedProgressRef.current) {
      hasRetriedProgressRef.current = true;
      fetchProgress();
    }
  }, [syncLoading, organizationId, loading, progress, fetchProgress]);

  useEffect(() => {
    if (syncLoading || !organizationId || loading || isComplete || isLegacyUser) return;
    if (!progress) {
      router.replace("/onboarding");
      return;
    }

    const step = Math.max(1, Math.min(progress.currentStep, 8));
    const allowed = isPathAllowedForStep(step, pathname);

    if (!allowed) {
      router.replace("/onboarding");
    }
  }, [syncLoading, organizationId, loading, isComplete, isLegacyUser, progress, pathname, router]);

  if (syncLoading || !organizationId || loading) {
    if (syncError && !syncLoading) {
      return (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-4">
          <p className="text-base text-muted-foreground">
            Something went wrong while loading your account.
          </p>
          <button
            type="button"
            onClick={retrySync}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      );
    }
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <p className="text-base text-muted-foreground">Preparing your setup…</p>
      </div>
    );
  }

  return (
    <>
      {!isComplete && !isLegacyUser && <OnboardingBanner />}
      {children}
    </>
  );
}
