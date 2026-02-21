import { Injectable, ForbiddenException } from "@nestjs/common";
import { getDb } from "@suki/database";
import { promos, businesses } from "@suki/database";
import { eq, and, desc, sql } from "drizzle-orm";

@Injectable()
export class PromosService {
  async create(
    businessId: string,
    organizationId: string,
    data: {
      type: string;
      value?: string;
      validityStart: Date;
      validityEnd: Date;
      audienceFilter?: Record<string, unknown>;
      messageContent?: string;
    },
  ) {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    const [p] = await db
      .insert(promos)
      .values({
        businessId,
        type: data.type as "discount" | "free_addon" | "loyalty" | "reminder" | "other",
        value: data.value ?? null,
        validityStart: new Date(data.validityStart),
        validityEnd: new Date(data.validityEnd),
        audienceFilter: data.audienceFilter ?? null,
        messageContent: data.messageContent ?? null,
      })
      .returning();
    return p!;
  }

  async list(
    businessId: string,
    organizationId: string,
    opts?: { limit?: number; offset?: number },
  ) {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    const condition = eq(promos.businessId, businessId);
    const baseQuery = db
      .select()
      .from(promos)
      .where(condition)
      .orderBy(desc(promos.createdAt));
    if (opts?.limit != null || opts?.offset != null) {
      const limit = opts?.limit ?? 50;
      const offset = opts?.offset ?? 0;
      const [items, countResult] = await Promise.all([
        baseQuery.limit(limit).offset(offset),
        db.select({ count: sql<number>`count(*)::int` }).from(promos).where(condition),
      ]);
      const total = countResult[0]?.count ?? 0;
      return { items, total, hasMore: offset + items.length < total, limit, offset };
    }
    return baseQuery;
  }

  async findById(id: string, organizationId: string) {
    const db = getDb();
    const [p] = await db.select().from(promos).where(eq(promos.id, id)).limit(1);
    if (!p) return null;
    await this.assertBusinessAccess(p.businessId, organizationId);
    return p;
  }

  async update(
    id: string,
    organizationId: string,
    data: {
      type?: string;
      value?: string;
      validityStart?: Date;
      validityEnd?: Date;
      audienceFilter?: Record<string, unknown>;
      messageContent?: string;
    },
  ) {
    const existing = await this.findById(id, organizationId);
    if (!existing) return null;
    const db = getDb();
    const [updated] = await db
      .update(promos)
      .set({
        ...(data.type && { type: data.type as "discount" | "free_addon" | "loyalty" | "reminder" | "other" }),
        ...(data.value !== undefined && { value: data.value ?? null }),
        ...(data.validityStart && { validityStart: new Date(data.validityStart) }),
        ...(data.validityEnd && { validityEnd: new Date(data.validityEnd) }),
        ...(data.audienceFilter !== undefined && { audienceFilter: data.audienceFilter ?? null }),
        ...(data.messageContent !== undefined && { messageContent: data.messageContent ?? null }),
        updatedAt: new Date(),
      })
      .where(eq(promos.id, id))
      .returning();
    return updated!;
  }

  async updateStatus(id: string, organizationId: string, status: "draft" | "sent" | "scheduled") {
    const existing = await this.findById(id, organizationId);
    if (!existing) return null;
    const db = getDb();
    const [updated] = await db
      .update(promos)
      .set({ status, updatedAt: new Date() })
      .where(eq(promos.id, id))
      .returning();
    return updated!;
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
