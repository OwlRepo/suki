import { describe, expect, it } from "vitest";
import { AI_QUOTAS } from "./ai-quotas";

describe("AI_QUOTAS free cap defaults", () => {
  it("applies same monthly caps for all plans", () => {
    expect(AI_QUOTAS.starter.monthlyTokenLimit).toBe(100_000);
    expect(AI_QUOTAS.growth.monthlyTokenLimit).toBe(100_000);
    expect(AI_QUOTAS.pro.monthlyTokenLimit).toBe(100_000);
    expect(AI_QUOTAS.starter.monthlyRequestLimit).toBe(100);
    expect(AI_QUOTAS.growth.monthlyRequestLimit).toBe(100);
    expect(AI_QUOTAS.pro.monthlyRequestLimit).toBe(100);
  });
});
