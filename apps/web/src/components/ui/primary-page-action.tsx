"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface PrimaryPageActionProps {
  children?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryActions?: React.ReactNode;
  destructiveAction?: React.ReactNode;
  hintText?: React.ReactNode;
  className?: string;
}

/**
 * Wrapper that enforces one visually dominant CTA per page section.
 * Use for the single primary action per page or per major section.
 */
export function PrimaryPageAction({
  children,
  primaryAction,
  secondaryActions,
  destructiveAction,
  hintText,
  className,
}: PrimaryPageActionProps) {
  const mainAction = primaryAction ?? children;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex w-full flex-wrap items-center gap-3">
        {mainAction && (
          <div className="w-full min-w-0 sm:w-auto sm:flex-shrink-0">
            {mainAction}
          </div>
        )}
        {secondaryActions && (
          <div className="flex flex-wrap items-center gap-2">{secondaryActions}</div>
        )}
        {destructiveAction && (
          <div className="ml-auto flex-shrink-0">{destructiveAction}</div>
        )}
      </div>
      {hintText && <p className="text-sm text-muted-foreground">{hintText}</p>}
    </div>
  );
}
