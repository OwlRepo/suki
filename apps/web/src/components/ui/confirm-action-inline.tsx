"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfirmActionInlineProps {
  /** Message shown when confirming */
  confirmMessage: React.ReactNode;
  /** Label for the primary confirm button */
  confirmLabel?: string;
  /** Label for the cancel button */
  cancelLabel?: string;
  /** Whether the action is destructive (uses destructive variant for confirm) */
  destructive?: boolean;
  /** Called when user confirms */
  onConfirm: () => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Optional loading state */
  loading?: boolean;
  className?: string;
}

/**
 * Lightweight inline confirmation for destructive or sensitive actions.
 * Replaces ad-hoc confirm() dialogs with visible, accessible inline UI.
 */
export function ConfirmActionInline({
  confirmMessage,
  confirmLabel = "Yes, continue",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
  loading = false,
  className,
}: ConfirmActionInlineProps) {
  return (
    <div
      className={cn(
        "inline-flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2",
        className
      )}
      role="alert"
      aria-live="assertive"
    >
      <span className="text-sm text-foreground">{confirmMessage}</span>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={destructive ? "destructive" : "default"}
          onClick={onConfirm}
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? "Please wait…" : confirmLabel}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
      </div>
    </div>
  );
}
