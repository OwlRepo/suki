"use client";

import Link from "next/link";
import { useOnboarding } from "@/contexts/onboarding-context";
import { ONBOARDING_STEPS } from "@/lib/onboarding";

interface NavLinkWithLockProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  /** Lock until this step is reached. Nav items always visible but show lock state. */
  unlockAfterStep?: number;
  /** Custom lock message */
  lockMessage?: string;
}

export function NavLinkWithLock({
  href,
  children,
  className = "",
  unlockAfterStep,
  lockMessage,
}: NavLinkWithLockProps) {
  const onboarding = useOnboarding();

  // No lock logic when onboarding is complete or not in use
  if (!onboarding || onboarding.onboardingCompletedAt || !unlockAfterStep) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  const isLocked = onboarding.currentStep < unlockAfterStep;

  return (
    <Link
      href={href}
      className={`${className} ${isLocked ? "opacity-70" : ""}`}
      title={isLocked ? lockMessage ?? "Unlocks after you complete earlier steps. You can skip for now." : undefined}
    >
      {children}
      {isLocked && (
        <span className="ml-1 text-xs text-muted-foreground">(unlocks later)</span>
      )}
    </Link>
  );
}
