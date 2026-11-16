import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, smsCredits, smsUsageEvents } from "@suki/database";
import { SQL } from "drizzle-orm";
import { SmsMeteringService } from "./sms-metering.service";

vi.mock("@suki/database", async () => {
  const actual = await vi.importActual<typeof import("@suki/database")>("@suki/database");
  return { ...actual, getDb: vi.fn() };
});

type Ledger = {
  organizationId: string;
  month: string;
  included: number;
  addon: number;
  used: number;
  pausedReason: string;
};

function createHarness(input: {
  ledger?: Ledger | null;
  previousLedger?: Record<string, number> | null;
  reserveMatches?: boolean;
}) {
  const state = {
    ledger: input.ledger ?? null,
    inserted: { credits: [] as Array<Record<string, unknown>>, usage: [] as Array<Record<string, unknown>> },
    updates: [] as Array<{ value: Record<string, unknown> }>,
  };

  const select = vi.fn(() => ({
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: async () => (input.previousLedger ? [input.previousLedger] : []),
        }),
        limit: async () => (state.ledger ? [state.ledger] : []),
      }),
    }),
  }));

  const insert = vi.fn((table: unknown) => ({
    values: (value: Record<string, unknown>) => {
      if (table === smsCredits) {
        state.inserted.credits.push(value);
        state.ledger = { pausedReason: "none", ...value } as Ledger;
      }
      if (table === smsUsageEvents) state.inserted.usage.push(value);
      const rows = [{ ...value, pausedReason: "none" }];
      return {
        returning: async () => rows,
        then: (resolve: (v: unknown) => void) => resolve(undefined),
      };
    },
  }));

  const update = vi.fn(() => ({
    set: (value: Record<string, unknown>) => ({
      where: () => {
        state.updates.push({ value });
        const rows = input.reserveMatches === false ? [] : [{ id: "credit-1" }];
        return {
          returning: async () => rows,
          then: (resolve: (v: unknown) => void) => resolve(undefined),
        };
      },
    }),
  }));

  vi.mocked(getDb).mockReturnValue({ select, insert, update } as never);
  return { state, update, insert };
}

const planCapacity = {
  getActivePlan: vi.fn(async () => "starter"),
  getIncludedCreditsPlan: vi.fn(async () => "starter"),
};

const currentLedger: Ledger = {
  organizationId: "org-1",
  month: "2026-11",
  included: 300,
  addon: 0,
  used: 10,
  pausedReason: "none",
};

describe("SmsMeteringService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-31T16:30:00.000Z"));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("error: reserve refuses when the conditional increment matches no row", async () => {
    createHarness({ ledger: currentLedger, reserveMatches: false });
    const service = new SmsMeteringService(planCapacity as never);

    await expect(service.reserve("org-1", 2)).resolves.toEqual({
      allowed: false,
      reason: "sms_cap_reached",
    });
  });

  it("error: reserve refuses with the paused reason without touching used", async () => {
    const { update } = createHarness({
      ledger: { ...currentLedger, pausedReason: "billing_past_due" },
    });
    const service = new SmsMeteringService(planCapacity as never);

    await expect(service.reserve("org-1", 1)).resolves.toEqual({
      allowed: false,
      reason: "billing_past_due",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("edge: new month credits start with carried add-on units", async () => {
    const { state } = createHarness({
      ledger: null,
      previousLedger: { included: 300, addon: 100, used: 350 },
    });
    const service = new SmsMeteringService(planCapacity as never);

    const credits = await service.getOrCreateCredits("org-1");

    expect(state.inserted.credits[0]).toMatchObject({ month: "2026-11", included: 300, addon: 50, used: 0 });
    expect(credits).toMatchObject({ included: 300, addon: 50, total: 350, remaining: 350 });
  });

  it("regression: past_due org gets free included SMS but keeps carried add-on units", async () => {
    planCapacity.getIncludedCreditsPlan.mockResolvedValueOnce("free");
    const { state } = createHarness({
      ledger: null,
      previousLedger: { included: 300, addon: 100, used: 350 },
    });
    const service = new SmsMeteringService(planCapacity as never);

    await service.getOrCreateCredits("org-1");

    expect(state.inserted.credits[0]).toMatchObject({ included: 0, addon: 50 });
  });

  it("regression: reserve increments used atomically and returns the reserved month", async () => {
    const { state } = createHarness({ ledger: currentLedger });
    const service = new SmsMeteringService(planCapacity as never);

    await expect(service.reserve("org-1", 2)).resolves.toEqual({ allowed: true, month: "2026-11" });
    expect(state.updates[0]!.value.used).toBeInstanceOf(SQL);
  });

  it("happy: release gives units back to the reserved month", async () => {
    const { state } = createHarness({ ledger: currentLedger });
    const service = new SmsMeteringService(planCapacity as never);

    await service.release("org-1", "2026-10", 2);

    expect(state.updates).toHaveLength(1);
    expect(state.updates[0]!.value.used).toBeInstanceOf(SQL);
  });

  it("happy: recordUsage writes the usage event without changing the ledger", async () => {
    const { state, update } = createHarness({ ledger: currentLedger });
    const service = new SmsMeteringService(planCapacity as never);

    await service.recordUsage("org-1", "biz-1", "evt-1", 2);

    expect(update).not.toHaveBeenCalled();
    expect(state.inserted.usage).toEqual([
      expect.objectContaining({ messageEventId: "evt-1", organizationId: "org-1", units: 2, status: "consumed" }),
    ]);
  });
});
