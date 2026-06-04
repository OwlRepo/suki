"use client";

import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  MessageSquareText,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrimaryPageAction } from "@/components/ui/primary-page-action";
import { StatusBanner } from "@/components/ui/status-banner";
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
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <MessageSquareText className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-950">
                {task.customerName}
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {task.businessName}
                {scheduledAt ? ` · ${scheduledAt}` : ""}
              </p>
            </div>

            <span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
              Needs review
            </span>
          </div>
        </div>
      </div>

      {task.duplicateRisk ? (
        <StatusBanner
          variant="warning"
          className="mt-4"
          message={
            <span className="inline-flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>
                Delivery could not be confirmed. Check with the customer before sending again to avoid a duplicate message.
              </span>
            </span>
          }
        />
      ) : null}

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-950">Message</p>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
          {task.messageBody}
        </p>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-500">
        Copy fallback is available if the SMS app does not prefill the body.
      </p>

      <PrimaryPageAction
        className="mt-4"
        primaryAction={
          <Button asChild className="w-full sm:w-auto">
            <a href={smsLink} onClick={() => void copyMessage(task.messageBody)}>
              <ExternalLink className="size-4" aria-hidden />
              Open SMS app
            </a>
          </Button>
        }
        secondaryActions={
          <>
            <Button
              type="button"
              variant="outline"
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
            <Button
              type="button"
              variant="outline"
              onClick={() => void onContacted(task.id)}
            >
              <CheckCircle2 className="size-4" aria-hidden />
              Mark as contacted
            </Button>
          </>
        }
        destructiveAction={
          <Button
            type="button"
            variant="outline"
            className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            onClick={() => void onDismiss(task.id)}
          >
            <Trash2 className="size-4" aria-hidden />
            Dismiss
          </Button>
        }
      />
    </article>
  );
}
