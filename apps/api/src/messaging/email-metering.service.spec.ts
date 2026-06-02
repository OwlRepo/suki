import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmailMeteringService } from "./email-metering.service";

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();
let queuedWhereResults: unknown[] = [];

vi.mock("@tyvera/database", () => ({
  getDb: () => ({
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
    limit: mockLimit,
    insert: mockInsert,
  }),
  emailCredits: {},
  emailUsageEvents: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: (a: unknown, b: unknown) => ({ type: "eq", a, b }),
  and: (...args: unknown[]) => ({ type: "and", args }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ type: "sql", strings, values }),
}));

describe("EmailMeteringService", () => {
  const planCapacity = {
    getActivePlan: vi.fn().mockResolvedValue("free"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queuedWhereResults = [];

    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockImplementation(() => {
      const next = queuedWhereResults.shift();
      return next ?? { limit: mockLimit };
    });
    mockLimit.mockResolvedValue([]);
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockReturning });
    mockReturning.mockResolvedValue([{ included: 100, used: 0 }]);
  });

  it("creates default monthly credits with free cap", async () => {
    const service = new EmailMeteringService(planCapacity as never);
    queuedWhereResults = [{ limit: mockLimit }];
    mockLimit.mockResolvedValueOnce([]);

    const out = await service.getOrCreateCredits("org-1", "2026-05");
    expect(out).toMatchObject({ included: 100, used: 0, remaining: 100, total: 100 });
  });

  it("blocks when cap is reached", async () => {
    const service = new EmailMeteringService(planCapacity as never);
    queuedWhereResults = [{ limit: mockLimit }];
    mockLimit.mockResolvedValueOnce([{ included: 100, used: 100 }]);

    const out = await service.canConsume("org-1", 1);
    expect(out).toEqual({ allowed: false, reason: "email_cap_reached" });
  });
});
