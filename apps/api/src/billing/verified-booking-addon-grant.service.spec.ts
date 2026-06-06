import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  creditReconciliationEvents,
  getDb,
  verifiedOnlineBookingAddons,
  verifiedOnlineBookingCredits,
} from "@tyvera/database";
import { VerifiedBookingAddonGrantService } from "./verified-booking-addon-grant.service";

vi.mock("@tyvera/database", async () => {
  const actual = await vi.importActual<typeof import("@tyvera/database")>(
    "@tyvera/database",
  );
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

function createGrantHarness() {
  const state = {
    ledger: {
      organizationId: "org-1",
      month: "2026-06",
      includedGranted: 30,
      addonGranted: 5,
      used: 4,
      sourcePlan: "starter",
    },
    inserted: {
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
        limit: async () => {
          if (table === verifiedOnlineBookingAddons) return [];
          if (table === verifiedOnlineBookingCredits) return [state.ledger];
          return [];
        },
      }),
    }),
  }));

  const insert = vi.fn((table: unknown) => ({
    values: async (value: Record<string, unknown>) => {
      if (table === verifiedOnlineBookingAddons) state.inserted.addons.push(value);
      if (table === creditReconciliationEvents) {
        state.inserted.reconciliation.push(value);
      }
    },
  }));

  const update = vi.fn((table: unknown) => ({
    set: (value: Record<string, unknown>) => ({
      where: async () => {
        if (table === verifiedOnlineBookingCredits) {
          state.updated.ledgers.push(value);
          state.ledger = { ...state.ledger, ...value };
        }
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
});
