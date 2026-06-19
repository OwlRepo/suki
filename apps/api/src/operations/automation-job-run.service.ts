import { Injectable } from "@nestjs/common";
import { automationJobRuns, getDb } from "@tyvera/database";
import { eq } from "drizzle-orm";
import { sql, type SQL } from "drizzle-orm";

type JobWorkResult<T> = {
  processedCount: number;
  successCount: number;
  failureCount: number;
  errorSummary?: unknown;
  result?: T;
};

type DbWithExecute = {
  execute: <T = Record<string, unknown>>(query: SQL) => Promise<T[]>;
};

@Injectable()
export class AutomationJobRunService {
  async record<T>(
    jobKey: string,
    work: () => Promise<JobWorkResult<T>>,
  ): Promise<T | undefined> {
    const db = getDb();
    const [run] = await db
      .insert(automationJobRuns)
      .values({
        jobKey,
        status: "running",
        processedCount: 0,
        successCount: 0,
        failureCount: 0,
        startedAt: new Date(),
      })
      .returning();

    try {
      const result = await work();
      await db
        .update(automationJobRuns)
        .set({
          status: "completed",
          processedCount: clampCount(result.processedCount),
          successCount: clampCount(result.successCount),
          failureCount: clampCount(result.failureCount),
          errorSummary: sanitizeErrorSummary(result.errorSummary),
          finishedAt: new Date(),
        })
        .where(eq(automationJobRuns.id, run.id));
      return result.result;
    } catch (error) {
      await db
        .update(automationJobRuns)
        .set({
          status: "failed",
          processedCount: 0,
          successCount: 0,
          failureCount: 1,
          errorSummary: sanitizeErrorSummary(error),
          finishedAt: new Date(),
        })
        .where(eq(automationJobRuns.id, run.id));
      throw error;
    }
  }

  async listRecentRuns(
    organizationId: string,
    businessId: string | undefined,
    days: number,
  ) {
    const db = getDb() as unknown as DbWithExecute;
    const windowDays = [1, 7, 30].includes(days) ? days : 7;
    const cutoff = timestampParam(
      new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000),
    );
    const rows = await db.execute<Record<string, unknown>>(sql`
      select
        id,
        job_key as "jobKey",
        status,
        processed_count as "processedCount",
        success_count as "successCount",
        failure_count as "failureCount",
        error_summary as "errorSummary",
        started_at as "startedAt",
        finished_at as "finishedAt"
      from automation_job_runs
      where started_at >= ${cutoff}::timestamptz
      order by started_at desc
      limit 20
    `);
    const [summary] = await db.execute<Record<string, unknown>>(sql`
      select
        max(case when job_key = 'appointment_reminders' then started_at end) as "lastAppointmentReminderRun",
        max(case when job_key = 'inactivity_winback' then started_at end) as "lastInactivityWinbackRun",
        max(case when job_key = 'semaphore_reconciliation' then started_at end) as "lastSemaphoreReconciliationRun",
        coalesce(sum(case when status = 'failed' and started_at >= ${cutoff}::timestamptz then 1 else 0 end), 0)::int as "failedRuns"
      from automation_job_runs
    `);

    return {
      dataScope: "platform_global" as const,
      requestedScope: {
        organizationId,
        businessId: businessId ?? null,
      },
      limitation:
        "automation_job_runs are not stored per organization or business in current schema.",
      days: windowDays,
      items: rows.map((row) => ({
        id: String(row.id ?? ""),
        jobKey: String(row.jobKey ?? "unknown"),
        status: String(row.status ?? "unknown"),
        processedCount: numberFrom(row.processedCount),
        successCount: numberFrom(row.successCount),
        failureCount: numberFrom(row.failureCount),
        errorSummary: row.errorSummary ?? null,
        startedAt: toIso(row.startedAt),
        finishedAt: toIso(row.finishedAt),
      })),
      summary: {
        lastAppointmentReminderRun: toIso(
          summary?.lastAppointmentReminderRun,
        ),
        lastInactivityWinbackRun: toIso(summary?.lastInactivityWinbackRun),
        lastSemaphoreReconciliationRun: toIso(
          summary?.lastSemaphoreReconciliationRun,
        ),
        failedRuns: numberFrom(summary?.failedRuns),
      },
    };
  }
}

function clampCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function sanitizeErrorSummary(error: unknown) {
  if (!error) return null;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message.slice(0, 500),
    };
  }
  if (typeof error === "string") {
    return { message: error.slice(0, 500) };
  }
  if (typeof error === "object") {
    return JSON.parse(JSON.stringify(error));
  }
  return { message: String(error).slice(0, 500) };
}

function numberFrom(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function toIso(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function timestampParam(value: Date) {
  return value.toISOString();
}
