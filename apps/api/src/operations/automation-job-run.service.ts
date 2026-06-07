import { Injectable } from "@nestjs/common";
import { automationJobRuns, getDb } from "@tyvera/database";
import { eq } from "drizzle-orm";

type JobWorkResult<T> = {
  processedCount: number;
  successCount: number;
  failureCount: number;
  errorSummary?: unknown;
  result?: T;
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
