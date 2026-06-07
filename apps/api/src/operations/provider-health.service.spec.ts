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

function sqlChunks(value: unknown): string {
  const chunks = (value as { queryChunks?: unknown[] }).queryChunks ?? [];
  return chunks
    .map((chunk) => {
      if (typeof chunk === "string" || typeof chunk === "number") return String(chunk);
      if ((chunk as { queryChunks?: unknown[] }).queryChunks) return sqlChunks(chunk);
      const value = (chunk as { value?: string[] }).value;
      return Array.isArray(value) ? value.join("") : "";
    })
    .join(" ");
}

function sqlBoundValues(value: unknown): unknown[] {
  const chunks = (value as { queryChunks?: unknown[] }).queryChunks ?? [];
  return chunks.flatMap((chunk) => {
    if ((chunk as { queryChunks?: unknown[] }).queryChunks) {
      return sqlBoundValues(chunk);
    }
    if ((chunk as { value?: string[] }).value) return [];
    return [chunk];
  });
}

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
    const params = state.execute.mock.calls.flatMap(([query]) => sqlBoundValues(query));
    expect(params.some((param) => param instanceof Date)).toBe(false);
    expect(params).toContain("2026-06-07T09:45:00.000Z");
    const executedSql = sqlChunks(state.execute.mock.calls[0][0]);
    expect(executedSql).toContain("created_at >=");
    expect(executedSql).toContain("::timestamptz");
  });

  it("counts queued Resend messages with explicit delivery/status checks instead of enum coalesce", async () => {
    const state = createHealthDbHarness();
    state.execute.mockResolvedValueOnce([
      { sent: 0, delivered: 0, failed: 0, bounced: 0, rejected: 0, queued: 2 },
    ]);

    await new ProviderHealthService({ evaluateEmailFailures: vi.fn() } as never)
      .aggregateResendHealth();

    expect(state.snapshots[0].metrics).toMatchObject({ queued: 2 });
    const executedSql = sqlChunks(state.execute.mock.calls[0][0]);
    expect(executedSql).not.toContain("coalesce(delivery_status, status)");
    expect(executedSql).toContain("delivery_status = 'queued'");
    expect(executedSql).toContain("delivery_status is null");
    expect(executedSql).toContain("status = 'queued'");
  });

  it("binds provider-health history cutoff as a timestamp string", async () => {
    const state = createHealthDbHarness();
    state.execute
      .mockResolvedValueOnce([
        {
          provider: "semaphore",
          status: "healthy",
          creditBalance: 900,
          metrics: {},
          observedAt: new Date("2026-06-07T09:55:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([]);

    await new ProviderHealthService({ evaluateEmailFailures: vi.fn() } as never)
      .getProviderHealth();

    const params = state.execute.mock.calls.flatMap(([query]) => sqlBoundValues(query));
    expect(params.some((param) => param instanceof Date)).toBe(false);
    expect(params).toContain("2026-06-06T10:00:00.000Z");
    const executedSql = sqlChunks(state.execute.mock.calls[1][0]);
    expect(executedSql).toContain("observed_at >=");
    expect(executedSql).toContain("::timestamptz");
  });
});
