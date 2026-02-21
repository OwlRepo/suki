"use client";

import * as React from "react";
import { useAuth } from "@clerk/nextjs";
import { apiRequest } from "@/lib/api";

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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="message-history-title"
    >
      <div className="w-full max-w-lg max-h-[80vh] rounded-lg border border-border bg-background shadow-lg flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 id="message-history-title" className="text-lg font-semibold">
            Message history — {customerName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
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
      </div>
    </div>
  );
}
