import { describe, it, expect } from "vitest";
import { buildUsageModel } from "./assistant-usage";

describe("buildUsageModel", () => {
  it("returns plain-language usage values and reset date", () => {
    const model = buildUsageModel({
      tokensUsed: 400,
      tokensLimit: 1000,
      requestsUsed: 20,
      requestsLimit: 100,
      resetDate: "2026-06-01",
      dailyTokensUsed: 50,
      dailyTokensLimit: 200,
      dailyRequestsUsed: 2,
      dailyRequestsLimit: 10,
      dailyResetDateTime: "2026-05-10T16:00:00.000Z",
      aiEnabled: true,
    });

    expect(model.tokens.remaining).toBe(600);
    expect(model.messages.remaining).toBe(80);
    expect(model.dailyResetLabel).toContain("Resets");
  });

  it("marks capped state when either messages or tokens are exhausted", () => {
    const model = buildUsageModel({
      tokensUsed: 1000,
      tokensLimit: 1000,
      requestsUsed: 60,
      requestsLimit: 100,
      resetDate: "2026-06-01",
      dailyTokensUsed: 200,
      dailyTokensLimit: 200,
      dailyRequestsUsed: 3,
      dailyRequestsLimit: 10,
      dailyResetDateTime: "2026-05-10T16:00:00.000Z",
      aiEnabled: true,
    });

    expect(model.capped).toBe(true);
    expect(model.tokens.state).toBe("capped");
  });

  it("marks daily capped even when monthly remaining exists", () => {
    const model = buildUsageModel({
      tokensUsed: 2000,
      tokensLimit: 100000,
      requestsUsed: 14,
      requestsLimit: 100,
      resetDate: "2026-06-01",
      dailyTokensUsed: 20000,
      dailyTokensLimit: 20000,
      dailyRequestsUsed: 14,
      dailyRequestsLimit: 20,
      dailyResetDateTime: "2026-05-10T16:00:00.000Z",
      aiEnabled: true,
    });

    expect(model.tokens.remaining).toBeGreaterThan(0);
    expect(model.dailyCapped).toBe(true);
    expect(model.daily.tokens.state).toBe("capped");
  });
});
