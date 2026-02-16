"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/contexts/onboarding-context";
import { useAccountFreshness } from "@/hooks/use-account-freshness";
import { PRACTICE_SAMPLE_LABEL, ONBOARDING_STEPS } from "@/lib/onboarding";
import { recordOnboardingEvent } from "@/lib/onboarding-metrics";

export function PracticeDayBanner() {
  const onboarding = useOnboarding();
  const { isFresh, loading } = useAccountFreshness();
  const [showConfirm, setShowConfirm] = useState(false);
  if (!onboarding?.practiceMode || onboarding.onboardingCompletedAt) return null;

  const handleSkip = () => {
    onboarding.skipPracticeDays();
    recordOnboardingEvent("practice_mode_exited", onboarding.organizationId);
  };

  const handleStartReal = () => {
    if (showConfirm) {
      onboarding.setPracticeMode(false);
      onboarding.setStep(ONBOARDING_STEPS.businessSetup);
      recordOnboardingEvent("practice_mode_exited", onboarding.organizationId);
      setShowConfirm(false);
    } else {
      setShowConfirm(true);
    }
  };

  const handleReinitialize = () => {
    onboarding.reinitializePracticeDays();
  };

  const canReinitialize = isFresh === true && !loading;

  return (
    <div
      className="mb-6 rounded-lg border border-amber-500/50 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-950/30"
      role="status"
    >
      <p className="text-base font-medium text-amber-900 dark:text-amber-100">
        You are in Practice Day. These are sample records for learning only. Your
        real customers are still untouched.
      </p>
      <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
        All items are clearly labeled with &quot;{PRACTICE_SAMPLE_LABEL}&quot;.
      </p>
      {showConfirm ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-amber-900 dark:text-amber-100">
            Sample records will be hidden. You can bring them back anytime in Help.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={handleStartReal}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              Yes, start with real data
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowConfirm(false)}
              className="border-amber-600 text-amber-900 hover:bg-amber-100 dark:border-amber-500 dark:text-amber-100 dark:hover:bg-amber-900/50"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleStartReal}
            className="border-amber-600 text-amber-900 hover:bg-amber-100 dark:border-amber-500 dark:text-amber-100 dark:hover:bg-amber-900/50"
          >
            Start with Real Data
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSkip}
            className="text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/50"
          >
            Skip Practice Days
          </Button>
          {canReinitialize && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleReinitialize}
              className="text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/50"
              title="Reset the checklist and start from Day 1. Only available while you haven't added any real data yet."
            >
              Re-initialize Practice
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
