import { describe, expect, it, vi } from "vitest";
import {
  smsAddonCarryover,
  unusedAddonUnits,
  verifiedBookingAddonCarryover,
} from "./addon-carryover";

function selectTx(rows: Array<Record<string, number>>) {
  const limit = vi.fn(async () => rows);
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { tx: { select } as never, orderBy, limit };
}

describe("addon carry-over", () => {
  it("error: carries nothing when usage exceeded included plus add-on", () => {
    expect(unusedAddonUnits({ included: 10, addon: 5, used: 20 })).toBe(0);
  });

  it("edge: carries all add-on units when usage stayed within included", () => {
    expect(unusedAddonUnits({ included: 10, addon: 5, used: 3 })).toBe(5);
  });

  it("edge: carries nothing when the org has no earlier ledger row", async () => {
    const { tx } = selectTx([]);
    await expect(smsAddonCarryover(tx, "org-1", "2026-11")).resolves.toBe(0);
  });

  it("regression: carries unused add-on units from the latest earlier sms ledger row", async () => {
    const { tx, orderBy, limit } = selectTx([{ included: 300, addon: 100, used: 350 }]);
    await expect(smsAddonCarryover(tx, "org-1", "2026-11")).resolves.toBe(50);
    expect(orderBy).toHaveBeenCalledTimes(1);
    expect(limit).toHaveBeenCalledWith(1);
  });

  it("regression: carries unused add-on units from the latest earlier booking ledger row", async () => {
    const { tx } = selectTx([{ included: 30, addon: 25, used: 40 }]);
    await expect(verifiedBookingAddonCarryover(tx, "org-1", "2026-11")).resolves.toBe(15);
  });
});
