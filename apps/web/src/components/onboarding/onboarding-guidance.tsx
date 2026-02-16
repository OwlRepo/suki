"use client";

import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/contexts/onboarding-context";
import { STEP_GUIDANCE, ONBOARDING_STEPS } from "@/lib/onboarding";

interface OnboardingGuidanceProps {
  step: number;
  screen: string;
  onComplete?: () => void;
  showSkip?: boolean;
}

export function OnboardingGuidance({
  step,
  screen,
  onComplete,
  showSkip = true,
}: OnboardingGuidanceProps) {
  const onboarding = useOnboarding();
  if (!onboarding || onboarding.currentStep !== step || onboarding.onboardingCompletedAt) {
    return null;
  }

  const guidance = STEP_GUIDANCE[step];
  if (!guidance) return null;

  return (
    <div
      className="mb-6 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 dark:border-primary/20 dark:bg-primary/10"
      role="region"
      aria-label={`Step ${step} guidance`}
    >
      <p className="text-base font-medium text-foreground">{guidance.message}</p>
      <p className="mt-2 text-sm text-muted-foreground">{guidance.expectedAction}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {onComplete && (
          <Button
            size="sm"
            onClick={() => {
              onboarding.advanceStep();
              onComplete();
            }}
          >
            I did this
          </Button>
        )}
        {showSkip && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onboarding.advanceStep()}
          >
            Skip for now
          </Button>
        )}
      </div>
    </div>
  );
}

export function OnboardingSuccessToast({ message }: { message: string }) {
  return (
    <p className="text-sm font-medium text-green-700 dark:text-green-400">
      {message}
    </p>
  );
}
