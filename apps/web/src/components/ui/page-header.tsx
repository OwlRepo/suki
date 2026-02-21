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

  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="space-y-1 min-w-0">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          {title}
        </h1>
        {supportingDescription && (
          <p className="text-helper max-w-2xl">{supportingDescription}</p>
        )}
        {whatThisPageIsFor && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              What this page is for:{" "}
            </span>
            {whatThisPageIsFor}
          </p>
        )}
        {whatToDoNext && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              What to do next:{" "}
            </span>
            {whatToDoNext}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
