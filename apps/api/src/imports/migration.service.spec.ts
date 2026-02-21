import { describe, it, expect, vi, beforeEach } from "vitest";
import { MigrationService } from "./migration.service";

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockDelete = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();

vi.mock("@suki/database", () => ({
  getDb: () => ({
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
    limit: mockLimit,
    update: mockUpdate,
    set: mockSet,
    delete: mockDelete,
    insert: mockInsert,
    values: mockValues,
  }),
  customers: {},
  businesses: {},
  importBatches: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: (a: unknown, b: unknown) => ({ type: "eq", a, b }),
  and: (...args: unknown[]) => ({ type: "and", args }),
  inArray: (a: unknown, b: unknown) => ({ type: "inArray", a, b }),
}));

describe("MigrationService", () => {
  let service: MigrationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MigrationService();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue([{ id: "biz1", organizationId: "org1" }]);
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  });

  describe("validateBatch", () => {
    it("validates rows with required name", async () => {
      const rows = [
        { name: "Alice", mobile: "555-1234", rowIndex: 1 },
        { name: "Bob", mobile: undefined, rowIndex: 2 },
      ];
      const report = await service.validateBatch(rows);
      expect(report.totalRows).toBe(2);
      expect(report.validRows).toBe(2);
      expect(report.errorCount).toBe(0);
    });

    it("rejects rows with missing name", async () => {
      const rows = [
        { name: "Alice", mobile: "555-1234", rowIndex: 1 },
        { name: "", mobile: "555-5678", rowIndex: 2 },
      ];
      const report = await service.validateBatch(rows);
      expect(report.validRows).toBe(1);
      expect(report.errors).toContainEqual(
        expect.objectContaining({ field: "name", message: "Name is required" }),
      );
    });

    it("rejects invalid mobile format", async () => {
      const rows = [{ name: "Alice", mobile: "invalid-phone!!", rowIndex: 1 }];
      const report = await service.validateBatch(rows);
      expect(report.validRows).toBe(0);
      expect(report.errors).toContainEqual(
        expect.objectContaining({ field: "mobile", message: "Invalid mobile format" }),
      );
    });
  });

  describe("rollbackBatch", () => {
    it("throws when batch not found", async () => {
      mockLimit.mockResolvedValueOnce([]);
      await expect(service.rollbackBatch("batch1", "org1")).rejects.toThrow();
    });

    it("returns 0 when batch already rolled back", async () => {
      mockLimit.mockResolvedValueOnce([
        { id: "b1", status: "rolled_back", customerIds: [] },
      ]);
      const result = await service.rollbackBatch("b1", "org1");
      expect(result).toEqual({ rolledBack: 0 });
    });
  });
});
