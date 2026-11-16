import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  creditReconciliationEvents,
  getDb,
  organizations,
  verifiedOnlineBookingAddons,
  verifiedOnlineBookingCredits,
} from "@suki/database";
import { SQL } from "drizzle-orm";
import { VerifiedBookingAddonGrantService } from "./verified-booking-addon-grant.service";

vi.mock("@suki/database", async () => {
  const actual = await vi.importActual<typeof import("@suki/database")>(
    "@suki/database",
  );
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

type BookingLedger = {
  organizationId: string;
  month: string;
  includedGranted: number;
  addonGranted: number;
  used: number;
  sourcePlan: string;
};

function createGrantHarness(input?: {
  addons?: Array<Record<string, unknown>>;
  ledger?: BookingLedger | null;
  organizations?: Array<Record<string, unknown>>;
  previousLedger?: Record<string, number> | null;
  grantUnits?: number;
}) {
  const state = {
    ledger: input?.ledger === null ? null : (input?.ledger ?? {
      organizationId: "org-1",
      month: "2026-06",
      includedGranted: 30,
      addonGranted: 5,
      used: 4,
      sourcePlan: "starter",
    }) as BookingLedger | null,
    addons: [...(input?.addons ?? [])],
    inserted: {
      ledgers: [] as Array<Record<string, unknown>>,
      addons: [] as Array<Record<string, unknown>>,
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
          if (table === verifiedOnlineBookingAddons) return state.addons.slice(0, 1);
          if (table === verifiedOnlineBookingCredits) return state.ledger ? [state.ledger] : [];
          if (table === organizations) return (input?.organizations ?? []).slice(0, 1);
          return [];
        },
      }),
    }),
  }));

  const insert = vi.fn((table: unknown) => ({
    values: async (value: Record<string, unknown>) => {
      if (table === verifiedOnlineBookingCredits) {
        state.inserted.ledgers.push(value);
        state.ledger = value as BookingLedger;
      }
      if (table === verifiedOnlineBookingAddons) {
        state.inserted.addons.push(value);
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
        if (table === verifiedOnlineBookingCredits && state.ledger) {
          state.updated.ledgers.push(value);
          // The service increments addonGranted in SQL; mirror that increment here.
          const addonGranted =
            typeof value.addonGranted === "number"
              ? value.addonGranted
              : state.ledger.addonGranted + (input?.grantUnits ?? 25);
          state.ledger = { ...state.ledger, addonGranted };
        }
        const row = state.ledger
          ? {
              includedGranted: state.ledger.includedGranted,
              addonGranted: state.ledger.addonGranted,
              used: state.ledger.used,
            }
          : null;
        return {
          returning: async () => (row ? [row] : []),
          then: (resolve: (value: unknown) => void) => resolve(undefined),
        };
      },
    }),
  }));

  vi.mocked(getDb).mockReturnValue({ select, insert, update } as never);

  return state;
}

describe("VerifiedBookingAddonGrantService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T10:00:00.000Z"));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("regression: first booking pack of the month seeds included bookings from the org plan", async () => {
    const state = createGrantHarness({
      ledger: null,
      organizations: [{ currentPlan: "starter" }],
    });
    const service = new VerifiedBookingAddonGrantService();

    await service.grant({
      organizationId: "org-1",
      units: 10,
      pricePhp: 299,
      sku: "online-booking-topup-10",
      source: "manual_payment",
      sourceReference: "manual-payment:seed",
    });

    expect(state.inserted.ledgers[0]).toMatchObject({
      month: "2026-06",
      includedGranted: 30,
      sourcePlan: "starter",
      used: 0,
    });
  });

  it("regression: new month booking ledger carries unused add-on units", async () => {
    const state = createGrantHarness({
      ledger: null,
      organizations: [{ currentPlan: "starter" }],
      previousLedger: { included: 30, addon: 25, used: 40 },
    });
    const service = new VerifiedBookingAddonGrantService();

    await service.grant({
      organizationId: "org-1",
      units: 10,
      pricePhp: 299,
      sku: "online-booking-topup-10",
      source: "manual_payment",
      sourceReference: "manual-payment:carry",
    });

    expect(state.inserted.ledgers[0]).toMatchObject({ addonGranted: 15 });
  });

  it("regression: grant increments addonGranted in SQL and never writes used", async () => {
    const state = createGrantHarness();
    const service = new VerifiedBookingAddonGrantService();

    await service.grant({
      organizationId: "org-1",
      units: 10,
      pricePhp: 299,
      sku: "online-booking-topup-10",
      source: "manual_payment",
      sourceReference: "manual-payment:sql",
    });

    const written = state.updated.ledgers[0]!;
    expect(written).not.toHaveProperty("used");
    expect(written.addonGranted).toBeInstanceOf(SQL);
  });

  it("increments the current-month addon ledger and writes reconciliation", async () => {
    const state = createGrantHarness();
    const service = new VerifiedBookingAddonGrantService();

    const result = await service.grant({
      organizationId: "org-1",
      units: 25,
      pricePhp: 699,
      sku: "online-booking-topup-25",
      source: "manual_payment",
      sourceReference: "manual-payment:item-1",
      purchasedByUserId: "user-1",
    });

    expect(result.alreadyGranted).toBe(false);
    expect(result.ledgerBefore).toMatchObject({ addonGranted: 5, used: 4 });
    expect(result.ledgerAfter).toMatchObject({ addonGranted: 30, used: 4 });
    expect(state.inserted.addons[0]).toMatchObject({
      organizationId: "org-1",
      units: 25,
      pricePhp: 699,
      sku: "online-booking-topup-25",
      source: "manual_payment",
      sourceReference: "manual-payment:item-1",
    });
    expect(state.inserted.reconciliation[0]).toMatchObject({
      organizationId: "org-1",
      creditType: "verified_online_booking",
      eventType: "manual_payment",
      addonBefore: 5,
      addonAfter: 30,
    });
  });

  it("does not grant twice for the same source and source reference", async () => {
    const state = createGrantHarness({
      addons: [
        {
          organizationId: "org-1",
          units: 25,
          source: "manual_payment",
          sourceReference: "manual-payment:item-1",
        },
      ],
    });
    const service = new VerifiedBookingAddonGrantService();

    const result = await service.grant({
      organizationId: "org-1",
      units: 25,
      pricePhp: 699,
      sku: "online-booking-topup-25",
      source: "manual_payment",
      sourceReference: "manual-payment:item-1",
      purchasedByUserId: "user-1",
    });

    expect(result.alreadyGranted).toBe(true);
    expect(state.updated.ledgers).toHaveLength(0);
    expect(state.inserted.addons).toHaveLength(0);
    expect(state.inserted.reconciliation).toHaveLength(0);
  });
});
