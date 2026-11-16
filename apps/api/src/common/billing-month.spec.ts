import { describe, expect, it } from "vitest";
import { billingMonthKey } from "./billing-month";

describe("billingMonthKey", () => {
  it("edge: rolls to the next month at Asia/Manila midnight", () => {
    expect(billingMonthKey(new Date("2026-10-31T16:00:00Z"))).toBe("2026-11");
  });

  it("edge: keeps the current month one second before Manila midnight", () => {
    expect(billingMonthKey(new Date("2026-10-31T15:59:59Z"))).toBe("2026-10");
  });

  it("edge: rolls the year at Manila midnight on Dec 31", () => {
    expect(billingMonthKey(new Date("2026-12-31T16:00:00Z"))).toBe("2027-01");
  });
});
