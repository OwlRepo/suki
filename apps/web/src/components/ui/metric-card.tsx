"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  /** Optional badge or helper text below value */
  suffix?: React.ReactNode;
  className?: string;
}

/**
 * Consistent metric display card for dashboards and summaries.
 */
export function MetricCard({ label, value, suffix, className }: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4",
        "min-w-0 flex flex-col",
        className
      )}
    >
      <p className="text-sm text-muted-foreground truncate">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
        {value}
      </p>
      {suffix && (
        <div className="mt-1 text-xs text-muted-foreground">{suffix}</div>
      )}
    </div>
  );
}
