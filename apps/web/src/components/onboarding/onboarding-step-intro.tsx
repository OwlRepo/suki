"use client";

import type { StepGuidance } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

export function OnboardingStepIntro({
  guidance,
  className,
}: {
  guidance: StepGuidance;
  className?: string;
}) {
  return (
    <div className={cn("space-y-6", className)}>
      <h1 className="text-2xl font-semibold text-foreground">{guidance.title}</h1>

      <div className="space-y-4 text-base">
        <section>
          <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            What this is
          </h2>
          <p className="text-foreground leading-relaxed">{guidance.whatThisIs}</p>
        </section>

        <section>
          <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Why this matters
          </h2>
          <p className="text-foreground leading-relaxed">{guidance.whyThisMatters}</p>
        </section>

        <section>
          <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Do this now
          </h2>
          <p className="text-foreground leading-relaxed">{guidance.doThisNow}</p>
        </section>
      </div>
    </div>
  );
}
