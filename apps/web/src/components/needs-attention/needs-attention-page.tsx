"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Info,
  MessageSquareWarning,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBanner } from "@/components/ui/status-banner";
import { ListSkeleton } from "@/components/ui/skeleton";
import {
  dismissManualFollowUp,
  listOpenManualFollowUps,
  markManualFollowUpContacted,
  retryManualFollowUpSms,
} from "./manual-follow-up.api";
import { ManualFollowUpCard } from "./manual-follow-up-card";
import type { ManualFollowUpTask } from "./manual-follow-up.types";

type ReasonFilter = "all" | "sms-failed" | "unconfirmed";

function getTaskSearchText(task: ManualFollowUpTask): string {
  return JSON.stringify(task).toLowerCase();
}

function isSmsFailed(task: ManualFollowUpTask): boolean {
  const text = getTaskSearchText(task);

  return (
    text.includes("sms failed") ||
    text.includes("delivery failed") ||
    text.includes("failed")
  );
}

function isUnconfirmed(task: ManualFollowUpTask): boolean {
  const text = getTaskSearchText(task);

  return (
    text.includes("unconfirmed") ||
    text.includes("unknown") ||
    text.includes("pending confirmation")
  );
}

export function NeedsAttentionPage() {
  const [tasks, setTasks] = useState<ManualFollowUpTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reasonFilter, setReasonFilter] = useState<ReasonFilter>("all");

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      setTasks(await listOpenManualFollowUps());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load tasks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function removeAfter(
    taskId: string,
    action: (id: string) => Promise<unknown>,
  ) {
    await action(taskId);
    setTasks((current) => current.filter((task) => task.id !== taskId));
  }

  const failedCount = useMemo(
    () => tasks.filter((task) => isSmsFailed(task)).length,
    [tasks],
  );

  const unconfirmedCount = useMemo(
    () => tasks.filter((task) => isUnconfirmed(task)).length,
    [tasks],
  );

  const filteredTasks = useMemo(() => {
    if (reasonFilter === "sms-failed") {
      return tasks.filter((task) => isSmsFailed(task));
    }

    if (reasonFilter === "unconfirmed") {
      return tasks.filter((task) => isUnconfirmed(task));
    }

    return tasks;
  }, [reasonFilter, tasks]);

  return (
    <div className="w-full space-y-6 sm:space-y-8">
      <PageHeader
        title="Needs Attention"
        plainLanguageDescription="Review appointment SMS reminders Tyvera could not confirm as sent."
        whatThisPageIsFor="Handle appointment reminder follow-ups that need staff judgment before the customer is contacted."
        whatToDoNext={
          tasks.length === 0
            ? "Keep this queue clear while you work through appointments."
            : "Open each task, contact the customer, then mark it contacted or dismiss it."
        }
      />

      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <RefreshCw className="size-5 animate-spin" />
            </span>

            <div>
              <h2 className="text-base font-bold text-slate-950">
                Loading tasks
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Checking for reminders that need staff review.
              </p>
            </div>
          </div>

          <ListSkeleton rowCount={4} className="mt-4" />
        </section>
      ) : null}

      {error ? (
        <StatusBanner
          variant="error"
          message={error}
          onDismiss={() => setError(null)}
        />
      ) : null}

      {!loading && !error && tasks.length == 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <CheckCircle2 className="size-5" />
            </span>

            <div>
              <h2 className="text-base font-bold text-slate-950">
                No reminders need attention
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Failed or unconfirmed appointment SMS reminders will appear here.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {!loading && !error && tasks.length > 0 ? (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                  <AlertCircle className="size-5" />
                </span>

                <div>
                  <p className="text-2xl font-bold tracking-tight text-slate-950">
                    {tasks.length}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-rose-600">
                    Needs attention
                  </p>
                  <p className="mt-2 text-sm leading-5 text-slate-500">
                    Open reminders requiring staff review
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <MessageSquareWarning className="size-5" />
                </span>

                <div>
                  <p className="text-2xl font-bold tracking-tight text-slate-950">
                    {failedCount}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-blue-600">
                    SMS failed
                  </p>
                  <p className="mt-2 text-sm leading-5 text-slate-500">
                    Could not be delivered
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <Clock3 className="size-5" />
                </span>

                <div>
                  <p className="text-2xl font-bold tracking-tight text-slate-950">
                    {unconfirmedCount}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-amber-600">
                    Unconfirmed
                  </p>
                  <p className="mt-2 text-sm leading-5 text-slate-500">
                    Delivery status is still unknown
                  </p>
                </div>
              </div>
            </article>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Reminder review queue
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Review each reminder, retry SMS when appropriate, or clear it
                  after contacting the customer manually.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => void refresh()}
                className="w-full gap-2 sm:w-auto"
              >
                <RefreshCw className="size-4" />
                Refresh
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={reasonFilter === "all" ? "default" : "outline"}
                onClick={() => setReasonFilter("all")}
              >
                All reasons
              </Button>

              <Button
                type="button"
                size="sm"
                variant={reasonFilter === "sms-failed" ? "default" : "outline"}
                onClick={() => setReasonFilter("sms-failed")}
              >
                SMS failed
              </Button>

              <Button
                type="button"
                size="sm"
                variant={reasonFilter === "unconfirmed" ? "default" : "outline"}
                onClick={() => setReasonFilter("unconfirmed")}
              >
                Unconfirmed
              </Button>
            </div>

            <div className="mt-5 space-y-3">
              {filteredTasks.length > 0 ? (
                filteredTasks.map((task) => (
                  <ManualFollowUpCard
                    key={task.id}
                    task={task}
                    onContacted={(id) =>
                      removeAfter(id, markManualFollowUpContacted)
                    }
                    onDismiss={(id) => removeAfter(id, dismissManualFollowUp)}
                    onRetrySms={(id) => removeAfter(id, retryManualFollowUpSms)}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                  <CheckCircle2 className="mx-auto size-7 text-slate-400" />
                  <p className="mt-3 text-sm font-medium text-slate-700">
                    No reminders match this filter.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                <Info className="size-5" />
              </span>

              <p className="text-sm leading-6 text-slate-700">
                <span className="font-semibold text-slate-950">Tip:</span>{" "}
                Review each item and decide whether to retry the reminder,
                contact the customer manually, or dismiss it if it is already
                handled.
              </p>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
