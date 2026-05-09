import { Injectable, ForbiddenException, BadRequestException } from "@nestjs/common";
import { getDb } from "@suki/database";
import { appointments, businesses, appointmentShareTemplates } from "@suki/database";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { AutomationSendService } from "../automation/automation-send.service";

@Injectable()
export class AppointmentsService {
  constructor(private readonly automationSend: AutomationSendService) {}
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
    const appointment = a!;
    void this.automationSend
      .sendAppointmentConfirmation(organizationId, businessId, appointment.id)
      .catch(() => {});
    return appointment;
  }

  async list(
    businessId: string,
    organizationId: string,
    opts?: { from?: Date; to?: Date; limit?: number; offset?: number },
  ) {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    const conditions = [eq(appointments.businessId, businessId)];
    if (opts?.from) conditions.push(gte(appointments.scheduledAt, opts.from));
    if (opts?.to) conditions.push(lte(appointments.scheduledAt, opts.to));
    const baseQuery = db
      .select()
      .from(appointments)
      .where(and(...conditions))
      .orderBy(desc(appointments.scheduledAt));
    if (opts?.limit != null || opts?.offset != null) {
      const limit = opts?.limit ?? 50;
      const offset = opts?.offset ?? 0;
      const [items, countResult] = await Promise.all([
        baseQuery.limit(limit).offset(offset),
        db.select({ count: sql<number>`count(*)::int` }).from(appointments).where(and(...conditions)),
      ]);
      const total = countResult[0]?.count ?? 0;
      return { items, total, hasMore: offset + items.length < total, limit, offset };
    }
    return baseQuery;
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
    if (status === "missed") {
      void this.automationSend
        .sendMissedRecovery(organizationId, a.businessId, id)
        .catch(() => {});
    }
    return updated!;
  }

  async markReminderSent(id: string, organizationId: string) {
    const existing = await this.findById(id, organizationId);
    if (!existing) return null;
    const db = getDb();
    const suffix = `[Reminder sent on ${new Date().toISOString().slice(0, 10)}]`;
    const newNotes = existing.notes
      ? `${existing.notes}\n${suffix}`
      : suffix;
    const now = new Date();
    const [updated] = await db
      .update(appointments)
      .set({
        notes: newNotes,
        reminder24hSentAt: existing.reminder24hSentAt ?? now,
        updatedAt: now,
      })
      .where(eq(appointments.id, id))
      .returning();
    return updated!;
  }

  async listShareTemplates(businessId: string, organizationId: string) {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    const rows = await db
      .select()
      .from(appointmentShareTemplates)
      .where(eq(appointmentShareTemplates.businessId, businessId))
      .orderBy(desc(appointmentShareTemplates.updatedAt));
    return rows;
  }

  async createShareTemplate(
    businessId: string,
    organizationId: string,
    data: { name: string; slots: string[] },
  ) {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    const name = data.name.trim();
    const slots = data.slots.map((s) => s.trim()).filter(Boolean);
    if (!name) throw new BadRequestException("Template name is required.");
    if (!slots.length) throw new BadRequestException("Add at least one time slot.");

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(appointmentShareTemplates)
      .where(eq(appointmentShareTemplates.businessId, businessId));
    if ((count ?? 0) >= 3) {
      throw new BadRequestException("You can save up to 3 templates. Delete one to save a new one.");
    }

    const [created] = await db
      .insert(appointmentShareTemplates)
      .values({ businessId, name, slots })
      .returning();
    return created!;
  }

  async updateShareTemplate(
    id: string,
    businessId: string,
    organizationId: string,
    data: { name?: string; slots?: string[] },
  ) {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    const [existing] = await db
      .select()
      .from(appointmentShareTemplates)
      .where(and(eq(appointmentShareTemplates.id, id), eq(appointmentShareTemplates.businessId, businessId)))
      .limit(1);
    if (!existing) throw new BadRequestException("Template not found.");

    const nextName = data.name?.trim();
    const nextSlots = data.slots?.map((s) => s.trim()).filter(Boolean);
    if (nextName !== undefined && !nextName) {
      throw new BadRequestException("Template name is required.");
    }
    if (nextSlots !== undefined && !nextSlots.length) {
      throw new BadRequestException("Add at least one time slot.");
    }

    const [updated] = await db
      .update(appointmentShareTemplates)
      .set({
        ...(nextName !== undefined && { name: nextName }),
        ...(nextSlots !== undefined && { slots: nextSlots }),
        updatedAt: new Date(),
      })
      .where(eq(appointmentShareTemplates.id, id))
      .returning();
    return updated!;
  }

  async deleteShareTemplate(id: string, businessId: string, organizationId: string) {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    const [deleted] = await db
      .delete(appointmentShareTemplates)
      .where(and(eq(appointmentShareTemplates.id, id), eq(appointmentShareTemplates.businessId, businessId)))
      .returning();
    if (!deleted) throw new BadRequestException("Template not found.");
    return deleted;
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
