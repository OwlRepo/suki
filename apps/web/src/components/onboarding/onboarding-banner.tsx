"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useOnboardingProgress } from "@/hooks/use-onboarding-progress";

export function OnboardingBanner() {
  const { isComplete } = useOnboardingProgress();

  if (isComplete) return null;

  return (
    <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">
          Complete your setup to unlock all features.
        </p>
        <Button asChild size="sm">
          <Link href="/onboarding">Continue setup</Link>
        </Button>
      </div>
    </div>
  );
}
