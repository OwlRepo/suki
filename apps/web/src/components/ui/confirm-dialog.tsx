"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}

/**
 * Modal confirmation for destructive or sensitive actions.
 * Replaces browser confirm() with accessible, readable Shadcn-styled dialog.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Yes, continue",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  const [internalLoading, setInternalLoading] = React.useState(false);
  const busy = loading || internalLoading;

  const handleConfirm = async () => {
    setInternalLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-base">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? "Please wait…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
