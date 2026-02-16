import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
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

  describe("parseXlsx", () => {
    function makeXlsxBase64(rows: (string | number)[][]): string {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      return Buffer.from(buf).toString("base64");
    }

    it("parses XLSX with name,mobile,notes headers", async () => {
      const base64 = makeXlsxBase64([
        ["name", "mobile", "notes"],
        ["Alice", "555-1234", "prefers text"],
        ["Bob", "555-5678", "VIP"],
      ]);
      const { rows, errors } = await service.parseXlsx(base64);
      expect(errors).toHaveLength(0);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ name: "Alice", mobile: "555-1234", notes: "prefers text" });
      expect(rows[1]).toMatchObject({ name: "Bob", mobile: "555-5678", notes: "VIP" });
    });

    it("detects alternate column names (customer, phone)", async () => {
      const base64 = makeXlsxBase64([
        ["customer", "phone", "note"],
        ["Jane Doe", "999-0000", "First visit"],
      ]);
      const { rows, errors } = await service.parseXlsx(base64);
      expect(errors).toHaveLength(0);
      expect(rows[0]).toMatchObject({ name: "Jane Doe", mobile: "999-0000", notes: "First visit" });
    });

    it("adds errors for rows with missing name", async () => {
      const base64 = makeXlsxBase64([
        ["name", "mobile"],
        ["Alice", "111"],
        ["", "222"],
        ["Bob", "333"],
      ]);
      const { rows, errors } = await service.parseXlsx(base64);
      expect(errors.some((e) => e.includes("missing name"))).toBe(true);
      expect(rows).toHaveLength(2);
    });

    it("returns empty rows when sheet has only headers", async () => {
      const base64 = makeXlsxBase64([["name", "mobile"]]);
      const { rows, errors } = await service.parseXlsx(base64);
      expect(rows).toHaveLength(0);
      expect(errors).toHaveLength(0);
    });
  });

  describe("parseOcr", () => {
    it("returns configured: false or true based on OCR env vars", async () => {
      const result = await service.parseOcr("base64-image-data");
      expect(typeof result.configured).toBe("boolean");
      expect(Array.isArray(result.rows)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
      if (!result.configured) {
        expect(result.message).toContain("OCR is not configured");
      } else {
        expect(result.message).toBeDefined();
      }
    });
  });
});
