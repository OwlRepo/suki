"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api";

interface VisitAdjustmentEntry {
  id: string;
  beforeCount: number;
  afterCount: number;
  reason: string;
  createdAt: string;
}

interface CustomerVisitHistoryModalProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
}

export function CustomerVisitHistoryModal({
  open,
  onClose,
  customerId,
  customerName,
}: CustomerVisitHistoryModalProps) {
  const { getToken } = useAuth();
  const [history, setHistory] = React.useState<VisitAdjustmentEntry[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open || !customerId) return;
    setLoading(true);
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await apiRequest<{ history: VisitAdjustmentEntry[] }>(
          `/customers/${customerId}/visit-adjustment-history`,
          { token },
        );
        setHistory(res.history ?? []);
      } catch {
        setHistory([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, customerId, getToken]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[80vh] flex flex-col sm:max-w-lg" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle id="visit-history-title">
            Visit adjustment history — {customerName}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No adjustments yet. When you correct a visit count, it will appear here.
            </p>
          ) : (
            <ul className="space-y-3" role="list">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="rounded-md border border-border bg-muted/30 p-3 text-sm"
                >
                  <p className="font-medium">
                    {h.beforeCount} → {h.afterCount} visits
                  </p>
                  <p className="mt-1 text-muted-foreground">{h.reason}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(h.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
