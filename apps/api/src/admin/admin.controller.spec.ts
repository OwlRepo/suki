import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminController } from "./admin.controller";

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
let queuedWhereResults: unknown[] = [];

vi.mock("@tyvera/database", () => ({
  getDb: () => ({
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
  }),
  businesses: { id: "businesses.id", organizationId: "businesses.organization_id" },
  customers: { businessId: "customers.business_id", createdAt: "customers.created_at" },
  appointments: {
    businessId: "appointments.business_id",
    status: "appointments.status",
    completedAt: "appointments.completed_at",
    scheduledAt: "appointments.scheduled_at",
  },
  promos: { businessId: "promos.business_id", status: "promos.status", updatedAt: "promos.updated_at" },
}));

vi.mock("drizzle-orm", () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    type: "sql",
    strings,
    values,
  }),
  inArray: (a: unknown, b: unknown) => ({ type: "inArray", a, b }),
  eq: (a: unknown, b: unknown) => ({ type: "eq", a, b }),
  desc: (a: unknown) => ({ type: "desc", a }),
  and: (...args: unknown[]) => ({ type: "and", args }),
  gte: (a: unknown, b: unknown) => ({ type: "gte", a, b }),
  gt: (a: unknown, b: unknown) => ({ type: "gt", a, b }),
  lte: (a: unknown, b: unknown) => ({ type: "lte", a, b }),
}));

describe("AdminController usage metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queuedWhereResults = [];
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockImplementation(() => queuedWhereResults.shift() ?? Promise.resolve([]));
  });

  it("uses completed appointments for visitsThisMonth", async () => {
    queuedWhereResults = [
      Promise.resolve([{ id: "biz1" }]),
      Promise.resolve([{ count: 1 }]),
      Promise.resolve([{ count: 2 }]),
      Promise.resolve([{ count: 0 }]),
      Promise.resolve([{ count: 4 }]),
    ];
    const controller = new AdminController({} as never, {} as never);

    await expect(controller.getUsage("org1", "biz1")).resolves.toEqual(
      expect.objectContaining({ visitsThisMonth: 2 }),
    );

    expect(mockFrom).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ completedAt: "appointments.completed_at" }),
    );
  });
});
