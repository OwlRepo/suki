"use client";

import * as React from "react";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type StatusBannerVariant = "success" | "error" | "info" | "warning";

interface StatusBannerProps {
  variant?: StatusBannerVariant;
  message: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
  /** Optional role - use "alert" for important messages that should be announced */
  role?: "alert" | "status";
}

const variantStyles: Record<StatusBannerVariant, string> = {
  success: "border-green-500/50 bg-green-500/10 text-green-800 dark:text-green-200 dark:bg-green-500/20",
  error: "border-destructive/50 bg-destructive/10 text-destructive dark:bg-destructive/20",
  info: "border-primary/30 bg-primary/5 text-foreground",
  warning: "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200 dark:bg-amber-500/20",
};

const variantMap: Record<StatusBannerVariant, "default" | "destructive"> = {
  success: "default",
  error: "destructive",
  info: "default",
  warning: "default",
};

/**
 * Visible inline status banner near forms/actions.
 * Replaces alert()-only feedback for success, error, info, and warning states.
 */
export function StatusBanner({
  variant = "info",
  message,
  onDismiss,
  className,
  role = "alert",
}: StatusBannerProps) {
  return (
    <Alert
      variant={variantMap[variant]}
      role={role}
      aria-live="polite"
      className={cn(
        "px-3 py-2",
        variant === "error" ? undefined : variantStyles[variant],
        className
      )}
    >
      <div className="col-span-2 flex items-center justify-between gap-2">
        <span>{message}</span>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded p-1 opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </div>
    </Alert>
  );
}
