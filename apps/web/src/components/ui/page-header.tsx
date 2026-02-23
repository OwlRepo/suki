"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  /** Optional description under the title */
  description?: React.ReactNode;
  /** Optional plain-language description for non-technical users */
  plainLanguageDescription?: React.ReactNode;
  /** Optional quick explanation: what this page is for */
  whatThisPageIsFor?: React.ReactNode;
  /** Optional quick instruction: what to do next */
  whatToDoNext?: React.ReactNode;
  /** Optional actions (buttons, etc.) aligned to the right on larger screens */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Consistent page header with title, optional description, and actions.
 * Aligned to dashboard layout (max-w-7xl) for consistent appearance across pages.
 */
export function PageHeader({
  title,
  description,
  plainLanguageDescription,
  whatThisPageIsFor,
  whatToDoNext,
  actions,
  className,
}: PageHeaderProps) {
  const supportingDescription = plainLanguageDescription ?? description;
  const hasGuidance = whatThisPageIsFor != null || whatToDoNext != null;

  return (
    <header
      className={cn(
        "relative w-full",
        "flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6",
        "pb-1",
        className,
      )}
      role="banner"
    >
      <div className="min-w-0 flex-1 space-y-3 max-w-2xl">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight sm:text-3xl">
          {title}
        </h1>
        {supportingDescription && (
          <p className="text-base text-muted-foreground leading-relaxed" style={{ lineHeight: 1.6 }}>
            {supportingDescription}
          </p>
        )}
        {hasGuidance && (
          <div className="flex flex-col gap-2 pt-2 border-l-2 border-muted-foreground/30 pl-4">
            {whatThisPageIsFor != null && (
              <p className="text-base text-muted-foreground leading-relaxed" style={{ lineHeight: 1.6 }}>
                <span className="font-medium text-foreground">What this page is for: </span>
                <span>{whatThisPageIsFor}</span>
              </p>
            )}
            {whatToDoNext != null && (
              <p className="text-base text-muted-foreground leading-relaxed" style={{ lineHeight: 1.6 }}>
                <span className="font-medium text-foreground">What to do next: </span>
                <span>{whatToDoNext}</span>
              </p>
            )}
          </div>
        )}
      </div>
      {actions != null && (
        <div className="flex shrink-0 flex-wrap items-start gap-2 sm:pt-0.5">
          {actions}
        </div>
      )}
    </header>
  );
}
