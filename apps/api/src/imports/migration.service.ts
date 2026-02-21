import { Injectable, ForbiddenException } from "@nestjs/common";
import { getDb } from "@suki/database";
import { customers, businesses, importBatches } from "@suki/database";
import { eq, and, inArray } from "drizzle-orm";
import type {
  MigrationValidationReport,
  DryRunResult,
  FieldMapping,
} from "./migration-types";
import type { MigrationEntity } from "./migration-types";

interface ParsedRowLike {
  name?: string;
  mobile?: string;
  notes?: string;
  title?: string;
  stage?: string;
  amount?: number;
  contactId?: string;
  rowIndex: number;
  [key: string]: unknown;
}

@Injectable()
export class MigrationService {
  async validateBatch(
    rows: ParsedRowLike[],
    opts?: { entityType?: MigrationEntity; mapping?: FieldMapping[] },
  ): Promise<MigrationValidationReport> {
    const entityType = opts?.entityType ?? "contacts";
    const errors: MigrationValidationReport["errors"] = [];
    let validRows = 0;

    if (entityType === "deals") {
      const contactIds = rows
        .map((r) => (r.contactId as string)?.trim())
        .filter((id): id is string => !!id);
      const db = getDb();
      const existingContactIds = new Set(
        contactIds.length > 0
          ? (
              await db
                .select({ id: customers.id })
                .from(customers)
                .where(inArray(customers.id, [...new Set(contactIds)]))
            ).map((r) => r.id)
          : [],
      );

      for (const row of rows) {
        let rowValid = true;
        if (!(row.title as string)?.trim()) {
          errors.push({ rowIndex: row.rowIndex, field: "title", message: "Title is required" });
          rowValid = false;
        }
        if (!(row.stage as string)?.trim()) {
          errors.push({ rowIndex: row.rowIndex, field: "stage", message: "Stage is required" });
          rowValid = false;
        }
        const contactId = (row.contactId as string)?.trim();
        if (contactId && !existingContactIds.has(contactId)) {
          errors.push({
            rowIndex: row.rowIndex,
            field: "contactId",
            message: "Contact ID does not reference an existing customer",
          });
          rowValid = false;
        }
        if (rowValid) validRows++;
      }
    } else {
      for (const row of rows) {
        let rowValid = true;
        if (!(row.name as string)?.trim()) {
          errors.push({ rowIndex: row.rowIndex, field: "name", message: "Name is required" });
          rowValid = false;
        }
        const mobile = (row.mobile as string) ?? "";
        if (mobile && !/^[\d\s\-+()]+$/.test(mobile.replace(/\s/g, ""))) {
          errors.push({
            rowIndex: row.rowIndex,
            field: "mobile",
            message: "Invalid mobile format",
          });
          rowValid = false;
        }
        if (rowValid) validRows++;
      }
    }

    return {
      totalRows: rows.length,
      validRows,
      errorCount: errors.length,
      errors,
    };
  }

  async runDryRun(
    businessId: string,
    organizationId: string,
    rows: ParsedRowLike[],
    skipRows: Set<number>,
    existingDuplicates: Array<{ rowIndex: number }>,
    entityType: MigrationEntity = "contacts",
  ): Promise<DryRunResult> {
    await this.assertBusinessAccess(businessId, organizationId);
    const report = await this.validateBatch(rows, { entityType });
    const wouldSkip = skipRows.size + existingDuplicates.length;
    const wouldImport = rows.filter(
      (r) => !skipRows.has(r.rowIndex) && !existingDuplicates.some((d) => d.rowIndex === r.rowIndex),
    ).length;
    return {
      mode: "dry_run",
      wouldImport,
      wouldSkip,
      duplicateCount: existingDuplicates.length,
      validationReport: report,
    };
  }

  async rollbackBatch(batchId: string, organizationId: string) {
    const db = getDb();
    const [batch] = await db
      .select()
      .from(importBatches)
      .where(
        and(
          eq(importBatches.id, batchId),
          eq(importBatches.organizationId, organizationId),
        ),
      )
      .limit(1);
    if (!batch) throw new ForbiddenException("Batch not found");
    if (batch.status === "rolled_back") return { rolledBack: 0 };
    const ids = (batch.customerIds ?? []) as string[];
    if (ids.length === 0) {
      await db
        .update(importBatches)
        .set({ status: "rolled_back" })
        .where(eq(importBatches.id, batchId));
      return { rolledBack: 0 };
    }
    await db.delete(customers).where(inArray(customers.id, ids));
    const rolledBack = ids.length;
    await db
      .update(importBatches)
      .set({ status: "rolled_back" })
      .where(eq(importBatches.id, batchId));
    return { rolledBack };
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
