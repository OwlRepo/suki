"use client";

import { useEffect, useState } from "react";
import {
  dismissManualFollowUp,
  listOpenManualFollowUps,
  markManualFollowUpContacted,
  retryManualFollowUpSms,
} from "./manual-follow-up.api";
import { ManualFollowUpCard } from "./manual-follow-up-card";
import type { ManualFollowUpTask } from "./manual-follow-up.types";

export function NeedsAttentionPage() {
  const [tasks, setTasks] = useState<ManualFollowUpTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  async function removeAfter(taskId: string, action: (id: string) => Promise<unknown>) {
    await action(taskId);
    setTasks((current) => current.filter((task) => task.id !== taskId));
  }

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Needs Attention
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          SMS reminders that need staff review.
        </p>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!loading && !error && tasks.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          No reminders need attention.
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
        {tasks.map((task) => (
          <ManualFollowUpCard
            key={task.id}
            task={task}
            onContacted={(id) => removeAfter(id, markManualFollowUpContacted)}
            onDismiss={(id) => removeAfter(id, dismissManualFollowUp)}
            onRetrySms={(id) => removeAfter(id, retryManualFollowUpSms)}
          />
        ))}
      </div>
    </section>
  );
}
