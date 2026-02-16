"use client";

import { useState } from "react";
import { useOnboarding } from "@/contexts/onboarding-context";
import { TOOLTIP_COPY } from "@/lib/onboarding";

type TooltipKey = keyof typeof TOOLTIP_COPY;

interface TooltipBadgeProps {
  screen: TooltipKey;
  children: React.ReactNode;
  className?: string;
}

export function TooltipBadge({ screen, children, className = "" }: TooltipBadgeProps) {
  const onboarding = useOnboarding();
  const [show, setShow] = useState(false);
  const copy = TOOLTIP_COPY[screen];

  if (!onboarding || onboarding.onboardingCompletedAt || !copy) {
    return <>{children}</>;
  }

  return (
    <span className={`relative inline-block ${className}`}>
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="cursor-help rounded border-b border-dashed border-primary/50"
        tabIndex={0}
        role="button"
        aria-describedby={show ? `tooltip-${screen}` : undefined}
      >
        {children}
      </span>
      {show && (
        <span
          id={`tooltip-${screen}`}
          role="tooltip"
          className="absolute left-0 top-full z-50 mt-1 max-w-xs rounded border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md"
        >
          {copy}
        </span>
      )}
    </span>
  );
}
