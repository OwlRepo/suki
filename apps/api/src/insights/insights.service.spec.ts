import { describe, it, expect, vi, beforeEach } from "vitest";
import { InsightsService } from "./insights.service";

// Mock the database module
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();

vi.mock("@suki/database", () => ({
  getDb: () => ({
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
    limit: mockLimit,
  }),
  customers: {},
  businesses: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: (a: unknown, b: unknown) => ({ type: "eq", a, b }),
  and: (...args: unknown[]) => ({ type: "and", args }),
  gte: (a: unknown, b: unknown) => ({ type: "gte", a, b }),
  lte: (a: unknown, b: unknown) => ({ type: "lte", a, b }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) =>
    ({ type: "sql", strings, values }),
}));

describe("InsightsService", () => {
  let service: InsightsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new InsightsService();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue(undefined);
  });

  it("returns null when business is not found", async () => {
    mockLimit.mockResolvedValueOnce([]); // business query returns empty

    const result = await service.getMonthlyMetrics("biz1", "org1", 2025, 1);
    expect(result).toBeNull();
  });
});
