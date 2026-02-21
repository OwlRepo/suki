"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface PrimaryPageActionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Wrapper that enforces one visually dominant CTA per page section.
 * Use for the single primary action per page or per major section.
 */
export function PrimaryPageAction({
  children,
  className,
}: PrimaryPageActionProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3",
        "[&>*:first-child]:inline-flex [&>*:first-child]:rounded-md",
        className,
      )}
    >
      {children}
    </div>
  );
}
