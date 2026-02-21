import { describe, it, expect } from "vitest";
import { MappingService } from "./mapping.service";
import type { MigrationEntity } from "./migration-types";
import type { FieldMapping } from "./migration-types";

describe("MappingService", () => {
  const service = new MappingService();

  describe("suggestMappings", () => {
    it("suggests contact mappings from common headers", () => {
      const headers = ["Customer Name", "Phone", "Notes"];
      const mappings = service.suggestMappings(headers, "contacts");
      expect(mappings.length).toBeGreaterThan(0);
      expect(mappings.some((m) => m.targetField === "name")).toBe(true);
      expect(mappings.some((m) => m.targetField === "mobile")).toBe(true);
    });

    it("suggests deal mappings from stage/title headers", () => {
      const headers = ["Deal Title", "Stage", "Amount", "Contact ID"];
      const mappings = service.suggestMappings(headers, "deals");
      expect(mappings.some((m) => m.targetField === "title")).toBe(true);
      expect(mappings.some((m) => m.targetField === "stage")).toBe(true);
    });

    it("returns empty when no headers match", () => {
      const mappings = service.suggestMappings(["xyz", "abc"], "contacts");
      expect(mappings).toHaveLength(0);
    });
  });

  describe("applyMapping", () => {
    it("transforms row with mappings", () => {
      const row = { "Customer Name": "Alice", Phone: "555-1234" };
      const mappings = [
        { sourceField: "Customer Name", targetField: "name", entityType: "contacts" as MigrationEntity },
        { sourceField: "Phone", targetField: "mobile", entityType: "contacts" as MigrationEntity },
      ];
      const out = service.applyMapping(row, mappings);
      expect(out).toEqual({ name: "Alice", mobile: "555-1234" });
    });

    it("applies lowercase transform", () => {
      const row = { Email: "Test@Example.COM" };
      const mappings: FieldMapping[] = [
        {
          sourceField: "Email",
          targetField: "email",
          entityType: "contacts" as MigrationEntity,
          transform: "lowercase",
        },
      ];
      const out = service.applyMapping(row, mappings);
      expect(out.email).toBe("test@example.com");
    });

    it("skips empty values", () => {
      const row = { name: "Alice", mobile: "" };
      const mappings = [
        { sourceField: "name", targetField: "name", entityType: "contacts" as MigrationEntity },
        { sourceField: "mobile", targetField: "mobile", entityType: "contacts" as MigrationEntity },
      ];
      const out = service.applyMapping(row, mappings);
      expect(out).toEqual({ name: "Alice" });
    });
  });

  describe("previewMappedRows", () => {
    it("returns limited preview of mapped rows", () => {
      const rows = [
        { name: "Alice", rowIndex: 1 },
        { name: "Bob", rowIndex: 2 },
        { name: "Charlie", rowIndex: 3 },
      ];
      const mappings = [
        { sourceField: "name", targetField: "name", entityType: "contacts" as MigrationEntity },
      ];
      const preview = service.previewMappedRows(rows, mappings, 2);
      expect(preview).toHaveLength(2);
      expect(preview[0]).toMatchObject({ name: "Alice", rowIndex: 1 });
      expect(preview[1]).toMatchObject({ name: "Bob", rowIndex: 2 });
    });
  });
});
