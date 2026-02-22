import { describe, it, expect, vi, beforeEach } from "vitest";
import { InsightsService } from "./insights.service";

// Mock the database module
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
    queuedWhereResults = [];
    service = new InsightsService();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockImplementation(() => {
      const next = queuedWhereResults.shift();
      return next ?? Promise.resolve([]);
    });
    mockLimit.mockResolvedValue([]);
  });

  it("returns null when business is not found", async () => {
    queuedWhereResults = [{ limit: mockLimit }];
    mockLimit.mockResolvedValueOnce([]); // business query returns empty

    const result = await service.getMonthlyMetrics("biz1", "org1", 2025, 1);
    expect(result).toBeNull();
  });

  it("returns monthly metrics using current repeat definitions", async () => {
    queuedWhereResults = [
      { limit: mockLimit }, // business lookup
      Promise.resolve([{ count: 1 }]), // new customers in month
      Promise.resolve([{ count: 2 }]), // returning customers (2+ visits)
      Promise.resolve([{ count: 3 }]), // customers seen this month
    ];
    mockLimit.mockResolvedValueOnce([{ id: "biz1" }]);

    const result = await service.getMonthlyMetrics("biz1", "org1", 2026, 2);

    expect(result).toEqual({
      year: 2026,
      month: 2,
      newCustomers: 1,
      repeatCustomers: 2,
      repeatVisits: 3,
    });
  });

  it("defaults metric counts to zero when queries return empty values", async () => {
    queuedWhereResults = [
      { limit: mockLimit }, // business lookup
      Promise.resolve([{}]), // new customers
      Promise.resolve([{}]), // returning customers
      Promise.resolve([{}]), // customers seen this month
    ];
    mockLimit.mockResolvedValueOnce([{ id: "biz1" }]);

    const result = await service.getMonthlyMetrics("biz1", "org1", 2026, 2);

    expect(result).toEqual({
      year: 2026,
      month: 2,
      newCustomers: 0,
      repeatCustomers: 0,
      repeatVisits: 0,
    });
  });
});
