"use client";

import * as React from "react";
import { useAuth } from "@clerk/nextjs";
import { apiRequest } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MessageEvent {
  id: string;
  channel: string;
  purpose: string;
  status: string;
  deliveryStatus?: string;
  failureReason?: string;
  sentAt?: string;
  createdAt: string;
}

interface CustomerMessageHistoryModalProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
}

export function CustomerMessageHistoryModal({
  open,
  onClose,
  customerId,
  customerName,
}: CustomerMessageHistoryModalProps) {
  const { getToken } = useAuth();
  const [events, setEvents] = React.useState<MessageEvent[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open || !customerId) return;
    setLoading(true);
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await apiRequest<{ events: MessageEvent[] }>(
          `/customers/${customerId}/message-history`,
          { token },
        );
        setEvents(res.events ?? []);
      } catch {
        setEvents([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, customerId, getToken]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[80vh] flex flex-col sm:max-w-lg" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle id="message-history-title">
            Message history — {customerName}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            <ul className="space-y-3">
              {events.map((e) => (
                <li
                  key={e.id}
                  className="rounded-md border border-border bg-muted/30 p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium capitalize">{e.channel}</span>
                    <span className="text-muted-foreground capitalize">
                      {e.purpose.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0 text-xs text-muted-foreground">
                    <span>Status: {e.status}</span>
                    {e.deliveryStatus && (
                      <span>Delivery: {e.deliveryStatus}</span>
                    )}
                    <span>
                      {e.sentAt
                        ? new Date(e.sentAt).toLocaleString()
                        : new Date(e.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {e.failureReason && (
                    <p className="mt-1 text-xs text-destructive">
                      Reason: {e.failureReason}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
