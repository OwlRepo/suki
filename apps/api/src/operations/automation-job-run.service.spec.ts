import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, automationJobRuns } from "@tyvera/database";
import { AutomationJobRunService } from "./automation-job-run.service";

vi.mock("@tyvera/database", async () => {
  const actual = await vi.importActual<typeof import("@tyvera/database")>(
    "@tyvera/database",
  );
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

function createDbHarness() {
  const inserted: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  const insert = vi.fn((table: unknown) => ({
    values: (value: Record<string, unknown>) => ({
      returning: async () => {
        if (table === automationJobRuns) {
          const row = { id: "run-1", ...value };
          inserted.push(row);
          return [row];
        }
        return [value];
      },
    }),
  }));
  const update = vi.fn((table: unknown) => ({
    set: (value: Record<string, unknown>) => ({
      where: async () => {
        if (table === automationJobRuns) updates.push(value);
      },
    }),
  }));
  vi.mocked(getDb).mockReturnValue({ insert, update } as never);
  return { inserted, updates };
}

describe("AutomationJobRunService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T10:00:00.000Z"));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("records a running job then marks it completed with deterministic counts", async () => {
    const state = createDbHarness();
    const service = new AutomationJobRunService();

    const result = await service.record("appointment_reminders", async () => ({
      processedCount: 3,
      successCount: 2,
      failureCount: 1,
      result: "done",
    }));

    expect(result).toBe("done");
    expect(state.inserted[0]).toMatchObject({
      jobKey: "appointment_reminders",
      status: "running",
      processedCount: 0,
      successCount: 0,
      failureCount: 0,
    });
    expect(state.updates[0]).toMatchObject({
      status: "completed",
      processedCount: 3,
      successCount: 2,
      failureCount: 1,
    });
    expect(state.updates[0].finishedAt).toBeInstanceOf(Date);
  });

  it("marks the run failed with a safe error summary when callback throws", async () => {
    const state = createDbHarness();
    const service = new AutomationJobRunService();

    await expect(
      service.record("inactivity_winback", async () => {
        throw new Error("provider secret token should not be stored");
      }),
    ).rejects.toThrow("provider secret token");

    expect(state.updates[0]).toMatchObject({
      status: "failed",
      processedCount: 0,
      successCount: 0,
      failureCount: 1,
    });
    expect(state.updates[0].errorSummary).toEqual({
      name: "Error",
      message: "provider secret token should not be stored",
    });
  });
});
