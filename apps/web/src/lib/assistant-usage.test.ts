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
      aiEnabled: true,
    });

    expect(model.tokens.remaining).toBe(600);
    expect(model.messages.remaining).toBe(80);
    expect(model.resetLabel).toContain("2026");
  });

  it("marks capped state when either messages or tokens are exhausted", () => {
    const model = buildUsageModel({
      tokensUsed: 1000,
      tokensLimit: 1000,
      requestsUsed: 60,
      requestsLimit: 100,
      resetDate: "2026-06-01",
      aiEnabled: true,
    });

    expect(model.capped).toBe(true);
    expect(model.tokens.state).toBe("capped");
  });
});
