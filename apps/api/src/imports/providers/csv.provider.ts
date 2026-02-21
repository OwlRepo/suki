import type { CanonicalContact, MigrationSource } from "../migration-types";

/**
 * CSV provider - transforms CSV rows into canonical contacts.
 * Used for spreadsheet/CSV migration (manual-source migration).
 */
export interface CsvRow {
  name: string;
  mobile?: string;
  notes?: string;
  [key: string]: unknown;
}

export function csvToCanonicalContacts(rows: CsvRow[]): CanonicalContact[] {
  return rows.map((row) => {
    const parts = (row.name ?? "").trim().split(/\s+/);
    const firstName = parts[0] ?? "";
    const lastName = parts.slice(1).join(" ") || undefined;
    return {
      firstName,
      lastName: lastName || undefined,
      mobile: row.mobile?.trim() || undefined,
      tags: row.notes ? [row.notes] : undefined,
    };
  });
}

export const CSV_PROVIDER: MigrationSource = "csv";
