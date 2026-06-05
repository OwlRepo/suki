import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomersService } from "./customers.service";

const executeMock = vi.fn();
const limitMock = vi.fn();
const whereMock = vi.fn();
const fromMock = vi.fn();
const selectMock = vi.fn();
const valuesMock = vi.fn();
const returningMock = vi.fn();
const insertMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@tyvera/database", () => ({
  getDb: () => ({
    select: selectMock,
    insert: insertMock,
    transaction: transactionMock,
  }),
  customers: {
    id: "customers.id",
    businessId: "customers.business_id",
    mobile: "customers.mobile",
  },
  businesses: {
    id: "businesses.id",
    organizationId: "businesses.organization_id",
  },
  messageEvents: {},
  visitAdjustmentHistory: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: (a: unknown, b: unknown) => ({ type: "eq", a, b }),
  and: (...args: unknown[]) => ({ type: "and", args }),
  ilike: (a: unknown, b: unknown) => ({ type: "ilike", a, b }),
  like: (a: unknown, b: unknown) => ({ type: "like", a, b }),
  or: (...args: unknown[]) => ({ type: "or", args }),
  desc: (a: unknown) => ({ type: "desc", a }),
  gte: (a: unknown, b: unknown) => ({ type: "gte", a, b }),
  lt: (a: unknown, b: unknown) => ({ type: "lt", a, b }),
  isNull: (a: unknown) => ({ type: "isNull", a }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    type: "sql",
    strings,
    values,
  }),
}));

describe("CustomersService booking identity resolution", () => {
  const automationSend = {
    sendPostVisitFollowup: vi.fn(),
    sendLoyaltyUnlock: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    selectMock.mockReturnValue({ from: fromMock });
    fromMock.mockReturnValue({ where: whereMock });
    whereMock.mockReturnValue({ limit: limitMock });
    insertMock.mockReturnValue({ values: valuesMock });
    valuesMock.mockReturnValue({ returning: returningMock });
    transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        execute: executeMock,
        select: selectMock,
        insert: insertMock,
      }),
    );
  });

  it("resolveForBooking reuses an exact business + normalized mobile match", async () => {
    limitMock
      .mockResolvedValueOnce([{ id: "biz1", organizationId: "org1" }])
      .mockResolvedValueOnce([{ id: "existing", businessId: "biz1", mobile: "+639171234567" }]);
    const service = new CustomersService(automationSend as never);

    await expect(
      service.resolveForBooking("biz1", "org1", {
        name: "Alice",
        mobile: " +639171234567 ",
      }),
    ).resolves.toEqual(
      expect.objectContaining({ id: "existing", mobile: "+639171234567" }),
    );
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("same mobile under a different business creates a different customer", async () => {
    limitMock
      .mockResolvedValueOnce([{ id: "biz2", organizationId: "org1" }])
      .mockResolvedValueOnce([]);
    returningMock.mockResolvedValueOnce([
      { id: "created", businessId: "biz2", mobile: "+639171234567" },
    ]);
    const service = new CustomersService(automationSend as never);

    await expect(
      service.resolveForBooking("biz2", "org1", {
        name: "Alice",
        mobile: "+639171234567",
      }),
    ).resolves.toEqual(expect.objectContaining({ id: "created" }));
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: "biz2", mobile: "+639171234567" }),
    );
  });

  it("missing mobile creates a customer", async () => {
    limitMock.mockResolvedValueOnce([{ id: "biz1", organizationId: "org1" }]);
    returningMock.mockResolvedValueOnce([{ id: "created", mobile: null }]);
    const service = new CustomersService(automationSend as never);

    await expect(
      service.resolveForBooking("biz1", "org1", { name: "No Phone" }),
    ).resolves.toEqual(expect.objectContaining({ id: "created" }));
    expect(valuesMock).toHaveBeenCalledWith(expect.objectContaining({ mobile: null }));
  });

  it("takes an advisory lock before exact-mobile lookup", async () => {
    limitMock
      .mockResolvedValueOnce([{ id: "biz1", organizationId: "org1" }])
      .mockResolvedValueOnce([{ id: "existing", businessId: "biz1", mobile: "+639171234567" }]);
    const service = new CustomersService(automationSend as never);

    await service.resolveForBooking("biz1", "org1", {
      name: "Alice",
      mobile: "+639171234567",
    });

    expect(executeMock.mock.invocationCallOrder[0]).toBeLessThan(
      selectMock.mock.invocationCallOrder[1],
    );
  });
});
