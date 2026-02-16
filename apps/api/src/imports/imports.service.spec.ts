import { describe, it, expect } from "vitest";
import { ImportsService } from "./imports.service";

describe("ImportsService", () => {
  const service = new ImportsService();

  describe("parseCsv", () => {
    it("parses CSV with standard headers", async () => {
      const csv = `name,mobile,notes
Alice,555-1234,prefers text
Bob,555-5678,VIP`;
      const { rows, errors } = await service.parseCsv(csv);
      expect(errors).toHaveLength(0);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        name: "Alice",
        mobile: "555-1234",
        notes: "prefers text",
        rowIndex: 2,
      });
      expect(rows[1]).toEqual({
        name: "Bob",
        mobile: "555-5678",
        notes: "VIP",
        rowIndex: 3,
      });
    });

    it("detects alternate column names (customer, phone, note)", async () => {
      const csv = `customer,phone,note
Jane Doe,999-0000,First visit`;
      const { rows, errors } = await service.parseCsv(csv);
      expect(errors).toHaveLength(0);
      expect(rows[0].name).toBe("Jane Doe");
      expect(rows[0].mobile).toBe("999-0000");
      expect(rows[0].notes).toBe("First visit");
    });

    it("adds errors for rows with missing name", async () => {
      const csv = `name,mobile
Alice,111
,222
Bob,333`;
      const { rows, errors } = await service.parseCsv(csv);
      expect(errors).toContain("Row 3: missing name");
      expect(rows).toHaveLength(2); // Alice and Bob only
    });

    it("returns empty rows and error for invalid CSV", async () => {
      // Malformed CSV with unterminated quoted field
      const csv = 'name,mobile\n"Alice,999';
      const { rows, errors } = await service.parseCsv(csv);
      expect(errors.length).toBeGreaterThan(0);
      expect(rows).toHaveLength(0);
    });

    it("handles empty content", async () => {
      const { rows, errors } = await service.parseCsv("");
      expect(rows).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });
  });
});
