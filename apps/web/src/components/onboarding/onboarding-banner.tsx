"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useOnboardingProgress } from "@/hooks/use-onboarding-progress";
import { Alert } from "@/components/ui/alert";

const FINAL_STEP = 8;

export function OnboardingBanner() {
  const { isComplete, currentStep } = useOnboardingProgress();

  if (isComplete) return null;

  const displayStep = Math.max(1, Math.min(currentStep, FINAL_STEP));

  return (
    <Alert className="mb-4 border-primary/30 bg-primary/5">
      <div className="col-span-2 flex w-full flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">
          Setup in progress — Step {displayStep} of {FINAL_STEP}. Finish to unlock all features.
        </p>
        <Button asChild size="sm">
          <Link href="/onboarding">Resume setup</Link>
        </Button>
      </div>
    </Alert>
  );
}
