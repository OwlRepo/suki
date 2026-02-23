"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** What this page/section is for */
  what: React.ReactNode;
  /** Why it matters to their business */
  why: React.ReactNode;
  /** Primary action to take next */
  nextAction?: React.ReactNode;
  className?: string;
}

/**
 * Reusable empty state that teaches instead of shames.
 * Follows "explain before asking" — what, why, and what to do next.
 */
export function EmptyState({ what, why, nextAction, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-border bg-card p-10 text-center",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <p className="text-lg font-medium text-foreground" data-slot="what">
        {what}
      </p>
      <p className="mt-3 max-w-md text-base text-muted-foreground leading-relaxed" data-slot="why" style={{ lineHeight: 1.6 }}>
        {why}
      </p>
      {nextAction && (
        <div className="mt-8" data-slot="next-action">
          {nextAction}
        </div>
      )}
    </div>
  );
}
