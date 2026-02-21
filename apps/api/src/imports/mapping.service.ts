import { Injectable } from "@nestjs/common";
import type {
  MigrationEntity,
  FieldMapping,
} from "./migration-types";

const CONTACT_TARGETS = ["name", "mobile", "notes", "firstName", "lastName", "email"];
const DEAL_TARGETS = ["title", "stage", "amount", "contactId", "companyId"];
const CANONICAL_ALIASES: Record<string, string[]> = {
  name: ["name", "customer", "customer_name", "full_name", "contact_name"],
  mobile: ["mobile", "phone", "contact", "cell", "telephone"],
  notes: ["notes", "note", "description", "comments"],
  firstName: ["firstname", "first_name", "given_name"],
  lastName: ["lastname", "last_name", "surname", "family_name"],
  email: ["email", "email_address", "e-mail"],
  title: ["title", "deal_name", "opportunity_name", "name"],
  stage: ["stage", "status", "pipeline_stage", "deal_stage"],
  amount: ["amount", "value", "deal_value", "revenue"],
  contactId: ["contact_id", "contact", "customer_id"],
  companyId: ["company_id", "company", "account_id"],
};

@Injectable()
export class MappingService {
  /**
   * Suggest field mappings from source headers to target fields for the given entity type.
   */
  suggestMappings(
    sourceHeaders: string[],
    entityType: MigrationEntity = "contacts",
  ): FieldMapping[] {
    const targets =
      entityType === "contacts"
        ? CONTACT_TARGETS
        : entityType === "deals"
          ? DEAL_TARGETS
          : CONTACT_TARGETS;
    const lowerHeaders = sourceHeaders.map((h) => h.toLowerCase().trim());
    const mappings: FieldMapping[] = [];

    for (const target of targets) {
      const aliases = CANONICAL_ALIASES[target] ?? [target];
      for (const alias of aliases) {
        const idx = lowerHeaders.findIndex(
          (h) => h === alias || h.includes(alias) || alias.includes(h),
        );
        if (idx >= 0) {
          mappings.push({
            sourceField: sourceHeaders[idx] ?? alias,
            targetField: target,
            entityType,
          });
          break;
        }
      }
    }
    return mappings;
  }

  /**
   * Apply a list of field mappings to a raw row, producing a normalized record.
   */
  applyMapping<T extends Record<string, unknown>>(
    row: T,
    mappings: FieldMapping[],
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const m of mappings) {
      const raw = row[m.sourceField];
      if (raw == null || raw === "") continue;
      let val: unknown = String(raw).trim();
      if (m.transform === "lowercase") val = String(val).toLowerCase();
      if (m.transform === "uppercase") val = String(val).toUpperCase();
      if (m.transform === "trim") val = String(val).trim();
      if (m.transform === "date" && typeof val === "string") {
        const d = new Date(val);
        val = isNaN(d.getTime()) ? val : d.toISOString().slice(0, 10);
      }
      out[m.targetField] = val;
    }
    return out;
  }

  /**
   * Return preview of mapped rows for UI display before dry-run.
   */
  previewMappedRows(
    rows: Array<Record<string, unknown> & { rowIndex?: number }>,
    mappings: FieldMapping[],
    limit = 10,
  ): Array<Record<string, unknown> & { rowIndex?: number }> {
    return rows.slice(0, limit).map((row) => ({
      ...this.applyMapping(row, mappings),
      rowIndex: row.rowIndex,
    }));
  }
}
