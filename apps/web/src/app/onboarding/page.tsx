"use client";

import { hasClerk } from "@/lib/clerk";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default function OnboardingPage() {
  if (!hasClerk) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-muted-foreground">
          Clerk authentication is not configured. Set
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to continue.
        </p>
      </div>
    );
  }
  return <OnboardingWizard />;
}
