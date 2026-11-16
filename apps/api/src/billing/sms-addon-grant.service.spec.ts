import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  creditReconciliationEvents,
  getDb,
  organizations,
  smsAddons,
  smsCredits,
} from "@suki/database";
import { SQL } from "drizzle-orm";
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

const orgBillingState = { getOrgBillingState: vi.fn() };

function createGrantHarness(input?: {
  ledger?: SmsLedger | null;
  addons?: Array<Record<string, unknown>>;
  organizations?: Array<Record<string, unknown>>;
  previousLedger?: Record<string, number> | null;
  grantUnits?: number;
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
        orderBy: () => ({
          limit: async () => (input?.previousLedger ? [input.previousLedger] : []),
        }),
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
      where: () => {
        if (table === smsCredits) {
          state.updated.ledgers.push(value);
          const current = state.ledger as SmsLedger;
          // The service increments addon in SQL; mirror that increment here.
          const addon =
            typeof value.addon === "number"
              ? value.addon
              : current.addon + (input?.grantUnits ?? 25);
          state.ledger = { ...current, addon };
        }
        const row = state.ledger
          ? { included: state.ledger.included, addon: state.ledger.addon, used: state.ledger.used }
          : null;
        return {
          returning: async () => (row ? [row] : []),
          then: (resolve: (value: unknown) => void) => resolve(undefined),
        };
      },
    }),
  }));

  vi.mocked(getDb).mockReturnValue({ select, insert, update } as never);
  const org = input?.organizations?.[0] as
    | { currentPlan?: string; includedCreditsPlan?: string }
    | undefined;
  orgBillingState.getOrgBillingState.mockResolvedValue(
    org ? { currentPlan: org.currentPlan, includedCreditsPlan: org.includedCreditsPlan ?? org.currentPlan } : null,
  );

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

  it("edge: ledger month follows Asia/Manila time", async () => {
    vi.setSystemTime(new Date("2026-10-31T16:30:00.000Z"));
    const state = createGrantHarness({
      ledger: null,
      organizations: [{ currentPlan: "starter" }],
    });
    const service = new SmsAddonGrantService(orgBillingState as never);

    await service.grant({
      organizationId: "org-1",
      units: 25,
      pricePhp: 599,
      source: "manual_payment",
      sourceReference: "manual-payment:item-manila",
    });

    expect(state.inserted.smsCredits[0]).toMatchObject({ month: "2026-11" });
  });

  it("edge: a grant that creates this month's ledger seeds the org plan's included allowance", async () => {
    const state = createGrantHarness({
      ledger: null,
      organizations: [{ currentPlan: "growth" }],
    });
    const service = new SmsAddonGrantService(orgBillingState as never);

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

  it("regression: new month ledger starts with unused add-on units from the latest earlier row", async () => {
    const state = createGrantHarness({
      ledger: null,
      organizations: [{ currentPlan: "starter" }],
      previousLedger: { included: 300, addon: 100, used: 350 },
    });
    const service = new SmsAddonGrantService(orgBillingState as never);

    const result = await service.grant({
      organizationId: "org-1",
      units: 25,
      pricePhp: 599,
      source: "manual_payment",
      sourceReference: "manual-payment:item-carry",
    });

    expect(state.inserted.smsCredits[0]).toMatchObject({ included: 300, addon: 50, used: 0 });
    expect(result.ledgerAfter).toMatchObject({ addon: 75 });
  });

  it("regression: grant increments addon in SQL and never writes used", async () => {
    const state = createGrantHarness();
    const service = new SmsAddonGrantService(orgBillingState as never);

    await service.grant({
      organizationId: "org-1",
      units: 25,
      pricePhp: 599,
      source: "manual_payment",
      sourceReference: "manual-payment:item-sql",
    });

    const written = state.updated.ledgers[0]!;
    expect(written).not.toHaveProperty("used");
    expect(written.addon).toBeInstanceOf(SQL);
  });

  it("regression: a grant during payment grace seeds the free included allowance but keeps the pack units", async () => {
    const state = createGrantHarness({
      ledger: null,
      organizations: [{ currentPlan: "growth", includedCreditsPlan: "free" }],
      previousLedger: { included: 800, addon: 40, used: 800 },
    });
    const service = new SmsAddonGrantService(orgBillingState as never);

    const result = await service.grant({
      organizationId: "org-1",
      units: 25,
      pricePhp: 599,
      source: "manual_payment",
      sourceReference: "manual-payment:item-grace",
    });

    expect(state.inserted.smsCredits[0]).toMatchObject({ included: 0, addon: 40 });
    expect(result.ledgerAfter).toMatchObject({ addon: 65 });
  });

  it("increments the current-month addon ledger and writes reconciliation", async () => {
    const state = createGrantHarness();
    const service = new SmsAddonGrantService(orgBillingState as never);

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
    const service = new SmsAddonGrantService(orgBillingState as never);

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
