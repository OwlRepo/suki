"use client";

import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ListSkeleton } from "@/components/ui/skeleton";
import { StatusBanner } from "@/components/ui/status-banner";
import type { PlatformAdminCommunicationDetail } from "./platform-admin-communications.types";

export function PlatformAdminMessageDetailDrawer({
  detail,
  error,
  loading,
  onOpenChange,
  onRetry,
  open,
}: {
  detail: PlatformAdminCommunicationDetail | null;
  error: string | null;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  open: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Message details</SheetTitle>
          <SheetDescription>
            Operational delivery details for one Tyvera communication.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <RefreshCw className="size-4 animate-spin" />
                Loading message details
              </div>
              <ListSkeleton rowCount={5} className="mt-4" />
            </div>
          ) : null}

          {error ? (
            <div className="space-y-3">
              <StatusBanner variant="error" message={error} />
              <Button type="button" variant="outline" onClick={onRetry}>
                Retry
              </Button>
            </div>
          ) : null}

          {!loading && !error && detail ? (
            <div className="space-y-4">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{detail.channel.toUpperCase()}</Badge>
                  <Badge variant="secondary">
                    {formatStatus(detail.deliveryStatus ?? detail.status)}
                  </Badge>
                </div>
                <dl className="mt-4 grid gap-3 text-sm">
                  <DetailRow label="Business" value={detail.business.name} />
                  <DetailRow label="Organization" value={detail.organization.name} />
                  <DetailRow label="Customer" value={detail.customer.name} />
                  <DetailRow label="Recipient" value={detail.customer.recipientMasked ?? "Not available"} />
                  <DetailRow label="Automation key" value={detail.automationKey} />
                  <DetailRow label="Provider" value={detail.provider ?? "Not available"} />
                  <DetailRow label="Provider message ID" value={detail.providerMessageId ?? "Not available"} />
                  <DetailRow label="Status" value={formatStatus(detail.status)} />
                  <DetailRow label="Delivery status" value={formatStatus(detail.deliveryStatus ?? "none")} />
                  <DetailRow label="Retry count" value={String(detail.retryCount)} />
                  <DetailRow label="SMS units consumed" value={String(detail.unitsConsumed)} />
                  <DetailRow label="Failure reason" value={detail.failureReason ?? "None"} />
                  <DetailRow label="Sent" value={formatDate(detail.sentAt) ?? "Not sent"} />
                  <DetailRow label="Created" value={formatDate(detail.createdAt) ?? "Unknown"} />
                </dl>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <h3 className="text-base font-bold text-slate-950">
                  Related manual follow-up
                </h3>
                {detail.manualFollowUpTask ? (
                  <dl className="mt-4 grid gap-3 text-sm">
                    <DetailRow label="Task ID" value={detail.manualFollowUpTask.id} />
                    <DetailRow label="Status" value={formatStatus(detail.manualFollowUpTask.status)} />
                    <DetailRow label="Failure reason" value={detail.manualFollowUpTask.failureReason} />
                    <DetailRow label="Created" value={formatDate(detail.manualFollowUpTask.createdAt) ?? "Unknown"} />
                    <DetailRow label="Resolved" value={formatDate(detail.manualFollowUpTask.resolvedAt) ?? "Open"} />
                  </dl>
                ) : (
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    No manual follow-up task is linked to this message.
                  </p>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[160px_1fr]">
      <dt className="font-semibold text-slate-700">{label}</dt>
      <dd className="break-words text-slate-950">{value}</dd>
    </div>
  );
}

function formatStatus(value: string) {
  return value.replace(/_/g, " ");
}

function formatDate(value?: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
