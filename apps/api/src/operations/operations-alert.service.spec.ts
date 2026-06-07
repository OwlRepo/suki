import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, operationsAlerts } from "@tyvera/database";
import { OperationsAlertService } from "./operations-alert.service";

vi.mock("@tyvera/database", async () => {
  const actual = await vi.importActual<typeof import("@tyvera/database")>(
    "@tyvera/database",
  );
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

function createAlertDbHarness() {
  const inserted: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  const unresolvedRows: Array<Record<string, unknown>> = [];
  const execute = vi.fn();
  const select = vi.fn(() => ({
    from: (table: unknown) => ({
      where: () => ({
        limit: async () => {
          if (table === operationsAlerts) return unresolvedRows.slice(0, 1);
          return [];
        },
      }),
    }),
  }));
  const insert = vi.fn((table: unknown) => ({
    values: (value: Record<string, unknown>) => ({
      returning: async () => {
        if (table === operationsAlerts) inserted.push(value);
        return [{ id: "alert-1", ...value }];
      },
    }),
  }));
  const update = vi.fn((table: unknown) => ({
    set: (value: Record<string, unknown>) => ({
      where: async () => {
        if (table === operationsAlerts) updates.push(value);
      },
    }),
  }));
  vi.mocked(getDb).mockReturnValue({ execute, select, insert, update } as never);
  return { execute, inserted, updates, unresolvedRows };
}

describe("OperationsAlertService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T10:00:00.000Z"));
    vi.clearAllMocks();
  });

  it("creates one warning alert for Semaphore low credit and does not duplicate unresolved alerts", async () => {
    const state = createAlertDbHarness();
    const service = new OperationsAlertService();

    await service.evaluateSemaphoreCreditBalance({
      balance: 350,
      warningThreshold: 500,
      criticalThreshold: 200,
    });
    state.unresolvedRows.push({ id: "alert-1", ...state.inserted[0] });
    await service.evaluateSemaphoreCreditBalance({
      balance: 350,
      warningThreshold: 500,
      criticalThreshold: 200,
    });

    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0]).toMatchObject({
      alertKey: "semaphore_credits_warning",
      severity: "warning",
      status: "open",
      provider: "semaphore",
    });
  });

  it("creates a critical Semaphore alert below the critical threshold", async () => {
    const state = createAlertDbHarness();

    await new OperationsAlertService().evaluateSemaphoreCreditBalance({
      balance: 100,
      warningThreshold: 500,
      criticalThreshold: 200,
    });

    expect(state.inserted[0]).toMatchObject({
      alertKey: "semaphore_credits_critical",
      severity: "critical",
    });
  });

  it("resolves an open Semaphore alert when the condition clears", async () => {
    const state = createAlertDbHarness();
    vi.mocked(getDb).mockReturnValue({
      ...vi.mocked(getDb)(),
      select: vi.fn(() => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: "alert-open", status: "open" }],
          }),
        }),
      })),
    } as never);

    await new OperationsAlertService().evaluateSemaphoreCreditBalance({
      balance: 800,
      warningThreshold: 500,
      criticalThreshold: 200,
    });

    expect(state.updates[0]).toMatchObject({ status: "resolved" });
  });

  it("creates warning and critical delivery alerts from aggregate failure rates", async () => {
    const state = createAlertDbHarness();
    const service = new OperationsAlertService();

    await service.evaluateSmsFailures({
      failed: 6,
      total: 30,
    });
    await service.evaluateSmsFailures({
      failed: 12,
      total: 25,
    });
    await service.evaluateEmailFailures({
      failed: 6,
      total: 30,
    });
    await service.evaluateOtpFailures({ failed: 3 });

    expect(state.inserted.map((alert) => alert.alertKey)).toEqual([
      "sms_failures_elevated",
      "sms_outage_suspected",
      "email_failures_elevated",
      "otp_failures_elevated",
    ]);
  });

  it("does not create missing-run alerts for disabled schedulers", async () => {
    const state = createAlertDbHarness();
    state.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await new OperationsAlertService().evaluateMissingAutomationRuns({
      autoFollowupsSchedulerEnabled: false,
      semaphoreReconciliationEnabled: false,
    });

    expect(state.inserted).toHaveLength(0);
  });

  it("creates a missing-run alert when an enabled expected job has no successful run", async () => {
    const state = createAlertDbHarness();
    state.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await new OperationsAlertService().evaluateMissingAutomationRuns({
      autoFollowupsSchedulerEnabled: true,
      semaphoreReconciliationEnabled: false,
    });

    expect(state.inserted[0]).toMatchObject({
      alertKey: "automation_run_missing:appointment_reminders",
      severity: "critical",
    });
  });
});
