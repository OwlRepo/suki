"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api";
import { fromError } from "@/lib/ui-feedback";

interface CustomerVisitAdjustmentModalProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  currentVisitCount: number;
  onSuccess: () => void;
}

export function CustomerVisitAdjustmentModal({
  open,
  onClose,
  customerId,
  customerName,
  currentVisitCount,
  onSuccess,
}: CustomerVisitAdjustmentModalProps) {
  const { getToken } = useAuth();
  const [afterCount, setAfterCount] = React.useState(String(currentVisitCount));
  const [reason, setReason] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setAfterCount(String(currentVisitCount));
      setReason("");
      setError(null);
    }
  }, [open, currentVisitCount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const count = parseInt(afterCount, 10);
    if (isNaN(count) || count < 0) {
      setError("Please enter a valid number (0 or greater).");
      return;
    }
    if (!reason.trim()) {
      setError("Please explain why you're changing the visit count.");
      return;
    }
    if (count === currentVisitCount) {
      setError("The new count is the same as the current count. No change needed.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      await apiRequest(`/customers/${customerId}/visit`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ afterCount: count, reason: reason.trim() }),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(fromError(err, "Failed to update visit count. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>Correct visit count</DialogTitle>
          <DialogDescription>
            {customerName} currently has {currentVisitCount} visit
            {currentVisitCount !== 1 ? "s" : ""}. Enter the correct count and a
            brief reason so you can track changes later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <Label htmlFor="visit-adjust-after">New visit count</Label>
            <Input
              id="visit-adjust-after"
              type="number"
              min={0}
              value={afterCount}
              onChange={(e) => setAfterCount(e.target.value)}
              className="mt-1 min-h-[44px]"
              aria-describedby="visit-adjust-hint"
            />
            <p id="visit-adjust-hint" className="mt-1 text-xs text-muted-foreground">
              Set to 0 if no visits should be recorded yet.
            </p>
          </div>
          <div>
            <Label htmlFor="visit-adjust-reason">
              Reason for change <span className="text-destructive">(required)</span>
            </Label>
            <Input
              id="visit-adjust-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Recorded 2 visits by mistake, correct to 1"
              className="mt-1 min-h-[44px]"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Updating…" : "Update visit count"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
