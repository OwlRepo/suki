import { Injectable, ForbiddenException } from "@nestjs/common";
import { getDb } from "@suki/database";
import { customers, businesses } from "@suki/database";
import { eq, and, ilike, sql, desc } from "drizzle-orm";

@Injectable()
export class CustomersService {
  async create(
    businessId: string,
    organizationId: string,
    data: {
      name: string;
      mobile?: string;
      notes?: string;
      preferences?: string;
    },
  ) {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    const [c] = await db
      .insert(customers)
      .values({
        businessId,
        name: data.name.trim(),
        mobile: data.mobile?.trim() || null,
        notes: data.notes?.trim() || null,
        preferences: data.preferences?.trim() || null,
      })
      .returning();
    return c!;
  }

  async list(
    businessId: string,
    organizationId: string,
    opts?: { search?: string; limit?: number; offset?: number },
  ) {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    const conditions = opts?.search?.trim()
      ? and(
          eq(customers.businessId, businessId),
          ilike(customers.name, `%${opts.search.trim()}%`),
        )
      : eq(customers.businessId, businessId);
    const limit = Math.min(opts?.limit ?? 50, 100);
    const offset = opts?.offset ?? 0;
    const list = await db
      .select()
      .from(customers)
      .where(conditions)
      .orderBy(desc(customers.updatedAt))
      .limit(limit)
      .offset(offset);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(conditions);
    return { customers: list, total: count };
  }

  async findById(id: string, organizationId: string) {
    const db = getDb();
    const [c] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1);
    if (!c) return null;
    await this.assertBusinessAccess(c.businessId, organizationId);
    return c;
  }

  async update(
    id: string,
    organizationId: string,
    data: { name?: string; mobile?: string; notes?: string; preferences?: string },
  ) {
    const existing = await this.findById(id, organizationId);
    if (!existing) return null;
    const db = getDb();
    const [updated] = await db
      .update(customers)
      .set({
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.mobile !== undefined && { mobile: data.mobile?.trim() || null }),
        ...(data.notes !== undefined && { notes: data.notes?.trim() || null }),
        ...(data.preferences !== undefined && {
          preferences: data.preferences?.trim() || null,
        }),
        updatedAt: new Date(),
      })
      .where(eq(customers.id, id))
      .returning();
    return updated!;
  }

  async delete(id: string, organizationId: string) {
    const existing = await this.findById(id, organizationId);
    if (!existing) return false;
    const db = getDb();
    await db.delete(customers).where(eq(customers.id, id));
    return true;
  }

  async stampVisit(id: string, organizationId: string) {
    const existing = await this.findById(id, organizationId);
    if (!existing) return null;
    const db = getDb();
    const now = new Date();
    const [updated] = await db
      .update(customers)
      .set({
        visitCount: existing.visitCount + 1,
        lastVisitAt: now,
        updatedAt: now,
      })
      .where(eq(customers.id, id))
      .returning();
    return updated!;
  }

  private async assertBusinessAccess(businessId: string, organizationId: string) {
    const db = getDb();
    const [biz] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);
    if (!biz || biz.organizationId !== organizationId) {
      throw new ForbiddenException("Business not found");
    }
  }
}
