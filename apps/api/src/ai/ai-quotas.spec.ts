import { describe, expect, it } from "vitest";
import { AI_QUOTAS } from "./ai-quotas";

describe("AI_QUOTAS freemium caps", () => {
  it("aligns monthly request access with the approved billing plans", () => {
    expect(AI_QUOTAS.free.monthlyRequestLimit).toBe(0);
    expect(AI_QUOTAS.starter.monthlyRequestLimit).toBe(0);
    expect(AI_QUOTAS.growth.monthlyRequestLimit).toBe(100);
    expect(AI_QUOTAS.pro.monthlyRequestLimit).toBe(500);
  });

  it("disables AI features on free and starter", () => {
    expect(AI_QUOTAS.free.allowedFeatures).toEqual([]);
    expect(AI_QUOTAS.starter.allowedFeatures).toEqual([]);
  });
});
