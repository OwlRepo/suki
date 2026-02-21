import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { getDb } from "@suki/database";
import { customers, businesses } from "@suki/database";
import { eq, and } from "drizzle-orm";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { OwnerGuard } from "../common/owner.guard";
import { Tenant } from "../common/tenant.decorator";
import { AuditLogService } from "./audit-log.service";

@Controller("privacy")
@UseGuards(ClerkAuthGuard, OwnerGuard)
export class PrivacyController {
  constructor(private readonly auditLog: AuditLogService) {}

  /**
   * Export customer data as CSV (DPA access request).
   */
  @Get("export")
  async exportData(
    @Query("businessId") businessId: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    if (!businessId) throw new BadRequestException("businessId required");
    await this.assertBusinessInOrg(businessId, orgId);

    const db = getDb();
    const rows = await db
      .select({
        id: customers.id,
        name: customers.name,
        mobile: customers.mobile,
        email: customers.email,
        tags: customers.tags,
        visitCount: customers.visitCount,
        lastVisitAt: customers.lastVisitAt,
        createdAt: customers.createdAt,
      })
      .from(customers)
      .where(eq(customers.businessId, businessId));

    const headers = ["id", "name", "mobile", "email", "tags", "visitCount", "lastVisitAt", "createdAt"];
    const escape = (v: unknown) => {
      if (v == null) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      headers.join(","),
      ...rows.map((r) =>
        headers
          .map((h) => escape((r as Record<string, unknown>)[h]))
          .join(","),
      ),
    ];
    const csv = lines.join("\n");

    await this.auditLog.log({
      organizationId: orgId,
      action: "export",
      entity: "customers",
      details: { businessId, rowCount: rows.length },
    });

    return { csv, contentType: "text/csv" };
  }

  /**
   * Correction update (DPA right to rectification).
   */
  @Patch("customers/:id/correct")
  async correctCustomer(
    @Param("id") id: string,
    @Body() body: { name?: string; mobile?: string; email?: string; notes?: string },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    const customer = await this.assertCustomerInOrg(id, orgId);

    const db = getDb();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.mobile !== undefined) updates.mobile = body.mobile?.trim() || null;
    if (body.email !== undefined) updates.email = body.email?.trim() || null;
    if (body.notes !== undefined) updates.notes = body.notes?.trim() || null;

    const [updated] = await db
      .update(customers)
      .set(updates as Record<string, string | Date | null>)
      .where(eq(customers.id, id))
      .returning();

    await this.auditLog.log({
      organizationId: orgId,
      action: "consent_change",
      entity: "customer",
      entityId: id,
      details: { type: "correction", fields: Object.keys(body) },
    });

    return { customer: updated };
  }

  /**
   * Delete/anonymize customer (DPA right to erasure). Retains minimal audit records.
   */
  @Delete("customers/:id/anonymize")
  async anonymizeCustomer(
    @Param("id") id: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    await this.assertCustomerInOrg(id, orgId);

    const db = getDb();
    const [updated] = await db
      .update(customers)
      .set({
        name: "[anonymized]",
        mobile: null,
        email: null,
        notes: null,
        preferences: null,
        tags: null,
        smsOptedOutAt: null,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, id))
      .returning();

    await this.auditLog.log({
      organizationId: orgId,
      action: "delete",
      entity: "customer",
      entityId: id,
      details: { type: "anonymize" },
    });

    return { customer: updated };
  }

  private async assertBusinessInOrg(businessId: string, orgId: string) {
    const db = getDb();
    const [b] = await db
      .select()
      .from(businesses)
      .where(and(eq(businesses.id, businessId), eq(businesses.organizationId, orgId)))
      .limit(1);
    if (!b) throw new ForbiddenException("Business not found");
  }

  private async assertCustomerInOrg(
    customerId: string,
    orgId: string,
  ): Promise<{ businessId: string }> {
    const db = getDb();
    const [c] = await db
      .select({ businessId: customers.businessId })
      .from(customers)
      .innerJoin(businesses, eq(customers.businessId, businesses.id))
      .where(
        and(eq(customers.id, customerId), eq(businesses.organizationId, orgId)),
      )
      .limit(1);
    if (!c) throw new ForbiddenException("Customer not found");
    return c;
  }
}
