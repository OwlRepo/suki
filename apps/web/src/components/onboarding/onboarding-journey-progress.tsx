"use client";

import { cn } from "@/lib/utils";

const TOTAL_STEPS = 8;

type StepStatus = "complete" | "current" | "upcoming";

function getStepStatus(stepNum: number, currentStep: number): StepStatus {
  if (stepNum < currentStep) return "complete";
  if (stepNum === currentStep) return "current";
  return "upcoming";
}

function getProgressPercent(currentStep: number): number {
  if (currentStep >= TOTAL_STEPS) return 100;
  return Math.round((currentStep / TOTAL_STEPS) * 100);
}

export function OnboardingJourneyProgress({
  currentStep,
  className,
}: {
  currentStep: number;
  className?: string;
}) {
  const percent = getProgressPercent(currentStep);
  const displayStep = Math.max(1, Math.min(currentStep, TOTAL_STEPS));

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          Step {displayStep} of {TOTAL_STEPS}
        </p>
        <p className="text-base font-semibold text-foreground">{percent}% complete</p>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Onboarding progress: ${percent}%`}
        />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((stepNum) => {
          const status = getStepStatus(stepNum, displayStep);
          return (
            <div
              key={stepNum}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors",
                status === "complete" &&
                  "bg-primary text-primary-foreground",
                status === "current" &&
                  "border-2 border-primary bg-background text-foreground",
                status === "upcoming" &&
                  "border border-border bg-muted/50 text-muted-foreground"
              )}
              aria-current={status === "current" ? "step" : undefined}
              aria-label={
                status === "complete"
                  ? `Step ${stepNum} completed`
                  : status === "current"
                    ? `Step ${stepNum}, current`
                    : `Step ${stepNum}, upcoming`
              }
            >
              {status === "complete" ? (
                <span aria-hidden>✓</span>
              ) : (
                stepNum
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
