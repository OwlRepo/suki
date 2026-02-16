import { Injectable, ForbiddenException } from "@nestjs/common";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { getDb } from "@suki/database";
import { customers, businesses } from "@suki/database";
import { eq, and } from "drizzle-orm";

export interface ParsedRow {
  name: string;
  mobile?: string;
  notes?: string;
  rowIndex: number;
}

export interface DuplicateMatch {
  rowIndex: number;
  existingId: string;
  existingName: string;
  reason: "name" | "mobile" | "both";
}

@Injectable()
export class ImportsService {
  async parseCsv(csvContent: string): Promise<{ rows: ParsedRow[]; errors: string[] }> {
    const errors: string[] = [];
    const rows: ParsedRow[] = [];
    try {
      const parsed = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      }) as Record<string, string>[];
      const nameCol = this.findColumn(parsed[0], ["name", "customer", "customer_name"]);
      const mobileCol = this.findColumn(parsed[0], ["mobile", "phone", "contact"]);
      const notesCol = this.findColumn(parsed[0], ["notes", "note"]);
      parsed.forEach((row, i) => {
        const name = (nameCol ? row[nameCol] : row["name"] ?? Object.values(row)[0])?.trim();
        if (!name) {
          errors.push(`Row ${i + 2}: missing name`);
          return;
        }
        rows.push({
          name,
          mobile: mobileCol ? row[mobileCol]?.trim() : undefined,
          notes: notesCol ? row[notesCol]?.trim() : undefined,
          rowIndex: i + 2,
        });
      });
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Failed to parse CSV");
    }
    return { rows, errors };
  }

  async parseXlsx(base64: string): Promise<{ rows: ParsedRow[]; errors: string[] }> {
    const errors: string[] = [];
    const rows: ParsedRow[] = [];
    try {
      const buffer = Buffer.from(base64, "base64");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        errors.push("No sheet found in file");
        return { rows, errors };
      }
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
      }) as (string | number)[][];
      if (!data.length) {
        errors.push("File is empty");
        return { rows, errors };
      }
      const headers = (data[0] ?? []).map((h) => String(h ?? "").trim());
      const nameCol = this.findColumnArr(headers, ["name", "customer", "customer_name"]);
      const mobileCol = this.findColumnArr(headers, ["mobile", "phone", "contact"]);
      const notesCol = this.findColumnArr(headers, ["notes", "note"]);
      for (let i = 1; i < data.length; i++) {
        const row = data[i] ?? [];
        const getVal = (idx: number | null) =>
          idx != null && row[idx] != null ? String(row[idx]).trim() : "";
        const name = nameCol != null ? getVal(nameCol) : getVal(0);
        if (!name) {
          errors.push(`Row ${i + 2}: missing name`);
          continue;
        }
        rows.push({
          name,
          mobile: mobileCol != null ? getVal(mobileCol) || undefined : undefined,
          notes: notesCol != null ? getVal(notesCol) || undefined : undefined,
          rowIndex: i + 2,
        });
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Failed to parse Excel file");
    }
    return { rows, errors };
  }

  async parseOcr(_base64Image: string): Promise<{
    configured: boolean;
    message?: string;
    rows: ParsedRow[];
    errors: string[];
  }> {
    const hasOcr = !!(
      process.env.OCR_API_URL ||
      process.env.TESSERACT_PATH ||
      process.env.GOOGLE_VISION_API_KEY
    );
    if (!hasOcr) {
      return {
        configured: false,
        message:
          "OCR is not configured. Please use CSV paste or Excel file upload instead.",
        rows: [],
        errors: [],
      };
    }
    return {
      configured: true,
      message: "OCR scan not yet implemented. Use CSV or Excel upload.",
      rows: [],
      errors: [],
    };
  }

  private findColumnArr(arr: string[], names: string[]): number | null {
    const lower = arr.map((a) => a.toLowerCase());
    for (const n of names) {
      const idx = lower.findIndex((k) => k.includes(n) || n.includes(k));
      if (idx >= 0) return idx;
    }
    return null;
  }

  async detectDuplicates(
    businessId: string,
    organizationId: string,
    rows: ParsedRow[],
  ): Promise<DuplicateMatch[]> {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    const existing = await db
      .select()
      .from(customers)
      .where(eq(customers.businessId, businessId));
    const matches: DuplicateMatch[] = [];
    for (const row of rows) {
      for (const ex of existing) {
        const nameMatch =
          ex.name.toLowerCase().trim() === row.name.toLowerCase().trim();
        const mobileMatch =
          row.mobile &&
          ex.mobile &&
          this.normalizeMobile(ex.mobile) === this.normalizeMobile(row.mobile);
        if (nameMatch && mobileMatch) {
          matches.push({
            rowIndex: row.rowIndex,
            existingId: ex.id,
            existingName: ex.name,
            reason: "both",
          });
          break;
        }
        if (mobileMatch) {
          matches.push({
            rowIndex: row.rowIndex,
            existingId: ex.id,
            existingName: ex.name,
            reason: "mobile",
          });
          break;
        }
        if (nameMatch) {
          matches.push({
            rowIndex: row.rowIndex,
            existingId: ex.id,
            existingName: ex.name,
            reason: "name",
          });
          break;
        }
      }
    }
    return matches;
  }

  async commitImport(
    businessId: string,
    organizationId: string,
    rows: ParsedRow[],
    skipRows: Set<number>,
  ) {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    const toInsert = rows.filter((r) => !skipRows.has(r.rowIndex));
    const inserted: { id: string; name: string }[] = [];
    for (const row of toInsert) {
      const [c] = await db
        .insert(customers)
        .values({
          businessId,
          name: row.name,
          mobile: row.mobile || null,
          notes: row.notes || null,
        })
        .returning();
      if (c) inserted.push({ id: c.id, name: c.name });
    }
    return { imported: inserted.length, customers: inserted };
  }

  private findColumn(row: Record<string, string>, names: string[]): string | null {
    const keys = Object.keys(row || {}).map((k) => k.toLowerCase());
    for (const n of names) {
      const found = keys.find((k) => k.includes(n) || n.includes(k));
      if (found) return Object.keys(row!).find((k) => k.toLowerCase() === found) ?? null;
    }
    return null;
  }

  private normalizeMobile(m: string): string {
    return m.replace(/\D/g, "").slice(-10);
  }

  private async assertBusinessAccess(businessId: string, organizationId: string) {
    const db = getDb();
    const [biz] = await db
      .select()
      .from(businesses)
      .where(
        and(
          eq(businesses.id, businessId),
          eq(businesses.organizationId, organizationId),
        ),
      )
      .limit(1);
    if (!biz) throw new ForbiddenException("Business not found");
  }
}
