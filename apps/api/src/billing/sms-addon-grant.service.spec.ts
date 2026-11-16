import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  creditReconciliationEvents,
  getDb,
  organizations,
  smsAddons,
  smsCredits,
} from "@suki/database";
import { SmsAddonGrantService } from "./sms-addon-grant.service";

vi.mock("@suki/database", async () => {
  const actual = await vi.importActual<typeof import("@suki/database")>(
    "@suki/database",
  );
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

type SmsLedger = {
  organizationId: string;
  month: string;
  included: number;
  addon: number;
  used: number;
  pausedReason?: string;
};

function createGrantHarness(input?: {
  ledger?: SmsLedger | null;
  addons?: Array<Record<string, unknown>>;
  organizations?: Array<Record<string, unknown>>;
}) {
  const state = {
    ledger: input?.ledger === null ? null : input?.ledger ?? {
      organizationId: "org-1",
      month: "2026-06",
      included: 300,
      addon: 10,
      used: 50,
      pausedReason: "none",
    },
    addons: [...(input?.addons ?? [])],
    inserted: {
      smsCredits: [] as Array<Record<string, unknown>>,
      smsAddons: [] as Array<Record<string, unknown>>,
      reconciliation: [] as Array<Record<string, unknown>>,
    },
    updated: {
      ledgers: [] as Array<Record<string, unknown>>,
    },
  };

  const select = vi.fn(() => ({
    from: (table: unknown) => ({
      where: () => ({
        limit: async () => {
          if (table === smsAddons) return state.addons.slice(0, 1);
          if (table === smsCredits) return state.ledger ? [state.ledger] : [];
          if (table === organizations) return (input?.organizations ?? []).slice(0, 1);
          return [];
        },
      }),
    }),
  }));

  const insert = vi.fn((table: unknown) => ({
    values: async (value: Record<string, unknown>) => {
      if (table === smsCredits) {
        state.inserted.smsCredits.push(value);
        state.ledger = value as SmsLedger;
      }
      if (table === smsAddons) {
        state.inserted.smsAddons.push(value);
        state.addons.push(value);
      }
      if (table === creditReconciliationEvents) {
        state.inserted.reconciliation.push(value);
      }
    },
  }));

  const update = vi.fn((table: unknown) => ({
    set: (value: Record<string, unknown>) => ({
      where: async () => {
        if (table === smsCredits) {
          state.updated.ledgers.push(value);
          state.ledger = { ...state.ledger, ...value } as SmsLedger;
        }
      },
    }),
  }));

  vi.mocked(getDb).mockReturnValue({ select, insert, update } as never);

  return state;
}

describe("SmsAddonGrantService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T10:00:00.000Z"));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("edge: a grant that creates this month's ledger seeds the org plan's included allowance", async () => {
    const state = createGrantHarness({
      ledger: null,
      organizations: [{ currentPlan: "growth" }],
    });
    const service = new SmsAddonGrantService();

    const result = await service.grant({
      organizationId: "org-1",
      units: 25,
      pricePhp: 599,
      source: "manual_payment",
      sourceReference: "manual-payment:item-2",
      purchasedByUserId: "user-1",
    });

    expect(state.inserted.smsCredits[0]).toMatchObject({
      organizationId: "org-1",
      month: "2026-06",
      included: 800,
      addon: 0,
      used: 0,
    });
    expect(result.ledgerAfter).toMatchObject({ included: 800, addon: 25, used: 0 });
  });

  it("increments the current-month addon ledger and writes reconciliation", async () => {
    const state = createGrantHarness();
    const service = new SmsAddonGrantService();

    const result = await service.grant({
      organizationId: "org-1",
      units: 25,
      pricePhp: 599,
      source: "manual_payment",
      sourceReference: "manual-payment:item-1",
      purchasedByUserId: "user-1",
      metadata: { billingRequestItemId: "item-1" },
    });

    expect(result.alreadyGranted).toBe(false);
    expect(result.ledgerBefore).toMatchObject({ addon: 10, used: 50 });
    expect(result.ledgerAfter).toMatchObject({ addon: 35, used: 50 });
    expect(state.inserted.smsAddons[0]).toMatchObject({
      organizationId: "org-1",
      packSize: 25,
      packPricePhp: 599,
      source: "manual_payment",
      sourceReference: "manual-payment:item-1",
      purchasedByUserId: "user-1",
    });
    expect(state.inserted.reconciliation[0]).toMatchObject({
      organizationId: "org-1",
      creditType: "sms_segment",
      eventType: "manual_payment",
      addonBefore: 10,
      addonAfter: 35,
      usedBefore: 50,
      usedAfter: 50,
    });
  });

  it("does not grant twice for the same source and source reference", async () => {
    const state = createGrantHarness({
      addons: [
        {
          organizationId: "org-1",
          packSize: 25,
          source: "manual_payment",
          sourceReference: "manual-payment:item-1",
        },
      ],
    });
    const service = new SmsAddonGrantService();

    const result = await service.grant({
      organizationId: "org-1",
      units: 25,
      pricePhp: 599,
      source: "manual_payment",
      sourceReference: "manual-payment:item-1",
      purchasedByUserId: "user-1",
    });

    expect(result.alreadyGranted).toBe(true);
    expect(state.updated.ledgers).toHaveLength(0);
    expect(state.inserted.smsAddons).toHaveLength(0);
    expect(state.inserted.reconciliation).toHaveLength(0);
  });
});
