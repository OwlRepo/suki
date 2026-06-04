"use client";

import { Copy, ExternalLink, RefreshCw, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSmsLink } from "./create-sms-link";
import type { ManualFollowUpTask } from "./manual-follow-up.types";

interface ManualFollowUpCardProps {
  task: ManualFollowUpTask;
  onContacted: (taskId: string) => Promise<void> | void;
  onDismiss: (taskId: string) => Promise<void> | void;
  onRetrySms: (taskId: string) => Promise<void> | void;
}

async function copyMessage(body: string) {
  await navigator.clipboard?.writeText(body);
}

export function ManualFollowUpCard({
  task,
  onContacted,
  onDismiss,
  onRetrySms,
}: ManualFollowUpCardProps) {
  const smsLink = createSmsLink(task.recipientMobile, task.messageBody);
  const scheduledAt = task.appointmentScheduledAt
    ? new Date(task.appointmentScheduledAt).toLocaleString()
    : null;

  return (
    <article className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">
          {task.customerName}
        </h2>
        <p className="text-sm text-muted-foreground">
          {task.businessName}
          {scheduledAt ? ` · ${scheduledAt}` : ""}
        </p>
      </div>

      {task.duplicateRisk ? (
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          Delivery could not be confirmed. Check with the customer before sending again to avoid a duplicate message.
        </p>
      ) : null}

      <div className="mt-4 rounded-md bg-muted p-3 text-sm text-foreground">
        <p className="whitespace-pre-wrap break-words">{task.messageBody}</p>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Copy fallback is available if the SMS app does not prefill the body.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Button asChild>
          <a href={smsLink} onClick={() => void copyMessage(task.messageBody)}>
            <ExternalLink className="size-4" aria-hidden />
            Open SMS app
          </a>
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void copyMessage(task.messageBody)}
        >
          <Copy className="size-4" aria-hidden />
          Copy message
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={task.duplicateRisk}
          onClick={() => void onRetrySms(task.id)}
        >
          <RefreshCw className="size-4" aria-hidden />
          Retry automatic SMS
        </Button>
        <Button type="button" onClick={() => void onContacted(task.id)}>
          <CheckCircle2 className="size-4" aria-hidden />
          Mark as contacted
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void onDismiss(task.id)}
        >
          <Trash2 className="size-4" aria-hidden />
          Dismiss
        </Button>
      </div>
    </article>
  );
}
