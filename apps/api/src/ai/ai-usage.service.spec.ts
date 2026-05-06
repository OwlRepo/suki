import { describe, it, expect, vi, beforeEach } from "vitest";
import { AiUsageService } from "./ai-usage.service";

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
let queuedWhereResults: unknown[] = [];

vi.mock("@suki/database", () => ({
  getDb: () => ({
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
    limit: mockLimit,
  }),
  aiUsageEvents: {},
  aiBudgets: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: (a: unknown, b: unknown) => ({ type: "eq", a, b }),
  and: (...args: unknown[]) => ({ type: "and", args }),
  gte: (a: unknown, b: unknown) => ({ type: "gte", a, b }),
  lte: (a: unknown, b: unknown) => ({ type: "lte", a, b }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ type: "sql", strings, values }),
}));

describe("AiUsageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queuedWhereResults = [];
    delete process.env.AI_DAILY_REQUEST_LIMIT;
    delete process.env.AI_DAILY_TOKEN_LIMIT;

    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockImplementation(() => {
      const next = queuedWhereResults.shift();
      return next ?? Promise.resolve([]);
    });
    mockLimit.mockResolvedValue([]);
  });

  it("blocks when daily request cap is exceeded", async () => {
    const planCapacity = { getActivePlan: vi.fn().mockResolvedValue("pro") };
    const service = new AiUsageService(planCapacity as never);
    process.env.AI_DAILY_REQUEST_LIMIT = "1";
    process.env.AI_DAILY_TOKEN_LIMIT = "999999";

    queuedWhereResults = [
      Promise.resolve([{ totalTokens: 100, totalRequests: 1 }]),
      Promise.resolve([{ dailyTokens: 100, dailyRequests: 1 }]),
      { limit: mockLimit },
    ];
    mockLimit.mockResolvedValueOnce([]);

    const result = await service.checkBudget("org-1", 10);
    expect(result).toEqual({ allowed: false, reason: "AI_DAILY_REQUEST_CAP_EXCEEDED" });
  });

  it("blocks when daily token cap is exceeded", async () => {
    const planCapacity = { getActivePlan: vi.fn().mockResolvedValue("pro") };
    const service = new AiUsageService(planCapacity as never);
    process.env.AI_DAILY_REQUEST_LIMIT = "9999";
    process.env.AI_DAILY_TOKEN_LIMIT = "100";

    queuedWhereResults = [
      Promise.resolve([{ totalTokens: 100, totalRequests: 1 }]),
      Promise.resolve([{ dailyTokens: 95, dailyRequests: 1 }]),
      { limit: mockLimit },
    ];
    mockLimit.mockResolvedValueOnce([]);

    const result = await service.checkBudget("org-1", 10);
    expect(result).toEqual({ allowed: false, reason: "AI_DAILY_TOKEN_CAP_EXCEEDED" });
  });
});
