import { Injectable, ForbiddenException } from "@nestjs/common";
import { getDb } from "@suki/database";
import { appointments, businesses } from "@suki/database";
import { eq, and, gte, lte, desc } from "drizzle-orm";

@Injectable()
export class AppointmentsService {
  async create(
    businessId: string,
    organizationId: string,
    data: {
      customerId: string;
      scheduledAt: Date;
      notes?: string;
    },
  ) {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    const [a] = await db
      .insert(appointments)
      .values({
        businessId,
        customerId: data.customerId,
        scheduledAt: new Date(data.scheduledAt),
        notes: data.notes ?? null,
      })
      .returning();
    return a!;
  }

  async list(
    businessId: string,
    organizationId: string,
    opts?: { from?: Date; to?: Date },
  ) {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    const conditions = [eq(appointments.businessId, businessId)];
    if (opts?.from) conditions.push(gte(appointments.scheduledAt, opts.from));
    if (opts?.to) conditions.push(lte(appointments.scheduledAt, opts.to));
    return db
      .select()
      .from(appointments)
      .where(and(...conditions))
      .orderBy(desc(appointments.scheduledAt));
  }

  async findById(id: string, organizationId: string) {
    const db = getDb();
    const [a] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, id))
      .limit(1);
    if (!a) return null;
    await this.assertBusinessAccess(a.businessId, organizationId);
    return a;
  }

  async update(
    id: string,
    organizationId: string,
    data: { scheduledAt?: Date; notes?: string },
  ) {
    const existing = await this.findById(id, organizationId);
    if (!existing) return null;
    const db = getDb();
    const [updated] = await db
      .update(appointments)
      .set({
        ...(data.scheduledAt && { scheduledAt: new Date(data.scheduledAt) }),
        ...(data.notes !== undefined && { notes: data.notes ?? null }),
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id))
      .returning();
    return updated!;
  }

  async updateStatus(
    id: string,
    organizationId: string,
    status: "scheduled" | "completed" | "missed" | "cancelled",
  ) {
    const db = getDb();
    const [a] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, id))
      .limit(1);
    if (!a) return null;
    await this.assertBusinessAccess(a.businessId, organizationId);
    const [updated] = await db
      .update(appointments)
      .set({ status, updatedAt: new Date() })
      .where(eq(appointments.id, id))
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
