import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, providerHealthSnapshots } from "@tyvera/database";
import { ProviderHealthService } from "./provider-health.service";

vi.mock("@tyvera/database", async () => {
  const actual = await vi.importActual<typeof import("@tyvera/database")>(
    "@tyvera/database",
  );
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

function createHealthDbHarness() {
  const snapshots: Array<Record<string, unknown>> = [];
  const execute = vi.fn();
  const insert = vi.fn((table: unknown) => ({
    values: (value: Record<string, unknown>) => ({
      returning: async () => {
        if (table === providerHealthSnapshots) snapshots.push(value);
        return [{ id: "snapshot-1", ...value }];
      },
    }),
  }));
  vi.mocked(getDb).mockReturnValue({ insert, execute } as never);
  return { snapshots, execute };
}

describe("ProviderHealthService", () => {
  const oldEnv = process.env;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T10:00:00.000Z"));
    vi.clearAllMocks();
    process.env = { ...oldEnv };
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = oldEnv;
    vi.unstubAllGlobals();
  });

  it("stores a Semaphore balance snapshot and evaluates low-credit alerts", async () => {
    process.env.SEMAPHORE_API_KEY = "sem-key";
    process.env.SEMAPHORE_CREDIT_WARNING_THRESHOLD = "500";
    process.env.SEMAPHORE_CREDIT_CRITICAL_THRESHOLD = "200";
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ credit_balance: 350 }),
    })));
    const state = createHealthDbHarness();
    const alerts = { evaluateSemaphoreCreditBalance: vi.fn() };

    await new ProviderHealthService(alerts as never).pollSemaphoreHealth();

    expect(state.snapshots[0]).toMatchObject({
      provider: "semaphore",
      status: "degraded",
      creditBalance: 350,
    });
    expect(state.snapshots[0].metrics).toMatchObject({
      warningThreshold: 500,
      criticalThreshold: 200,
    });
    expect(alerts.evaluateSemaphoreCreditBalance).toHaveBeenCalledWith({
      balance: 350,
      warningThreshold: 500,
      criticalThreshold: 200,
    });
  });

  it("stores an unknown Semaphore snapshot without crashing when API key is missing", async () => {
    delete process.env.SEMAPHORE_API_KEY;
    const state = createHealthDbHarness();

    await expect(
      new ProviderHealthService({ evaluateSemaphoreCreditBalance: vi.fn() } as never)
        .pollSemaphoreHealth(),
    ).resolves.toBeUndefined();

    expect(state.snapshots[0]).toMatchObject({
      provider: "semaphore",
      status: "unknown",
      creditBalance: null,
    });
  });

  it("aggregates Resend message health from existing message events", async () => {
    const state = createHealthDbHarness();
    state.execute.mockResolvedValueOnce([
      { sent: 10, delivered: 8, failed: 1, bounced: 1, rejected: 0, queued: 2 },
    ]);

    await new ProviderHealthService({ evaluateEmailFailures: vi.fn() } as never)
      .aggregateResendHealth();

    expect(state.snapshots[0]).toMatchObject({
      provider: "resend",
      status: "degraded",
      creditBalance: null,
      metrics: {
        sent: 10,
        delivered: 8,
        failed: 1,
        bounced: 1,
        rejected: 0,
        queued: 2,
        failureRatePct: 16.67,
      },
    });
  });
});
