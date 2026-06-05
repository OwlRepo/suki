import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { getDb } from "@tyvera/database";
import {
  appointments,
  businesses,
  customers,
  appointmentShareTemplates,
  bookingHolds,
  bookingSecuritySettings,
  bookingPinAttemptLogs,
} from "@tyvera/database";
import { eq, and, gte, lte, desc, sql, inArray } from "drizzle-orm";
import { AutomationSendService } from "../automation/automation-send.service";
import { IntakeBookingService } from "../intake/intake-booking.service";
import {
  appointmentDurationMinutesForBusinessType,
  appointmentLifecycleDueAt,
} from "../common/appointment-timing";
import { createHash, timingSafeEqual } from "node:crypto";

const PIN_LOCKOUT_WINDOW_MINUTES = 15;
const PIN_MAX_ATTEMPTS = 5;

type DatabaseLikeError = {
  code?: string;
  message?: string;
};

export function isBookingSecurityCompatibilityError(error: unknown): boolean {
  const candidate = error as DatabaseLikeError | undefined;
  const message = String(candidate?.message ?? "").toLowerCase();
  return (
    candidate?.code === "42P01" ||
    candidate?.code === "42703" ||
    candidate?.code === "42704" ||
    message.includes("booking_security_settings") ||
    message.includes("booking_pin_attempt_logs") ||
    message.includes("appointment_verification_mode")
  );
}

export function isAppointmentsVerificationCompatibilityError(error: unknown): boolean {
  const candidate = error as DatabaseLikeError | undefined;
  const message = String(candidate?.message ?? "").toLowerCase();
  return (
    candidate?.code === "42703" ||
    message.includes("verification_mode") ||
    message.includes("otp_skip_reason") ||
    message.includes("verified_by_user_id") ||
    message.includes("verified_at") ||
    message.includes("duration_minutes") ||
    message.includes("checked_in_at") ||
    message.includes("needs_review_at") ||
    message.includes("completed_at") ||
    message.includes("visit_recorded_at")
  );
}

const appointmentLegacySelect = {
  id: appointments.id,
  customerId: appointments.customerId,
  businessId: appointments.businessId,
  scheduledAt: appointments.scheduledAt,
  status: appointments.status,
  notes: appointments.notes,
  confirmationSentAt: appointments.confirmationSentAt,
  reminder24hSentAt: appointments.reminder24hSentAt,
  reminder72hSentAt: appointments.reminder72hSentAt,
  missedRecoverySentAt: appointments.missedRecoverySentAt,
  staffName: appointments.staffName,
  createdAt: appointments.createdAt,
  updatedAt: appointments.updatedAt,
} as const;

function withVerificationCompatibility<T extends Record<string, unknown>>(row: T) {
  return {
    ...row,
    durationMinutes: (row.durationMinutes as number | undefined) ?? 30,
    checkedInAt: (row.checkedInAt as Date | null | undefined) ?? null,
    needsReviewAt: (row.needsReviewAt as Date | null | undefined) ?? null,
    completedAt: (row.completedAt as Date | null | undefined) ?? null,
    visitRecordedAt: (row.visitRecordedAt as Date | null | undefined) ?? null,
    verificationMode: "otp_verified" as const,
    otpSkipReason: null,
    verifiedByUserId: null,
    verifiedAt: (row.createdAt as Date | undefined) ?? new Date(),
  };
}

export function hashOtpSkipPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}

export function isValidOtpSkipPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly automationSend: AutomationSendService,
    private readonly intakeBookingService: IntakeBookingService,
  ) {}
  async create(
    businessId: string,
    organizationId: string,
    data: {
      customerId: string;
      scheduledAt: Date;
      notes?: string;
    },
  ) {
    const business = await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    const [a] = await db
      .insert(appointments)
      .values({
        businessId,
        customerId: data.customerId,
        scheduledAt: new Date(data.scheduledAt),
        durationMinutes: appointmentDurationMinutesForBusinessType(
          business.businessType,
        ),
        notes: data.notes ?? null,
      })
      .returning(appointmentLegacySelect);
    const appointment = withVerificationCompatibility(a!);
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
      let items: Array<Record<string, unknown>> = [];
      const countPromise = db.select({ count: sql<number>`count(*)::int` }).from(appointments).where(and(...conditions));
      try {
        items = (await baseQuery.limit(limit).offset(offset)) as Array<Record<string, unknown>>;
      } catch (error) {
        if (!isAppointmentsVerificationCompatibilityError(error)) throw error;
        items = (await db
          .select(appointmentLegacySelect)
          .from(appointments)
          .where(and(...conditions))
          .orderBy(desc(appointments.scheduledAt))
          .limit(limit)
          .offset(offset)) as Array<Record<string, unknown>>;
        items = items.map((row) => withVerificationCompatibility(row));
      }
      const countResult = await countPromise;
      const total = countResult[0]?.count ?? 0;
      return { items, total, hasMore: offset + items.length < total, limit, offset };
    }
    try {
      return await baseQuery;
    } catch (error) {
      if (!isAppointmentsVerificationCompatibilityError(error)) throw error;
      const items = await db
        .select(appointmentLegacySelect)
        .from(appointments)
        .where(and(...conditions))
        .orderBy(desc(appointments.scheduledAt));
      return items.map((row) => withVerificationCompatibility(row));
    }
  }

  async findById(id: string, organizationId: string) {
    const db = getDb();
    let a:
      | Record<string, unknown>
      | undefined;
    try {
      [a] = (await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, id))
        .limit(1)) as Array<Record<string, unknown>>;
    } catch (error) {
      if (!isAppointmentsVerificationCompatibilityError(error)) throw error;
      [a] = (await db
        .select(appointmentLegacySelect)
        .from(appointments)
        .where(eq(appointments.id, id))
        .limit(1)) as Array<Record<string, unknown>>;
      if (a) a = withVerificationCompatibility(a);
    }
    if (!a) return null;
    await this.assertBusinessAccess(String(a.businessId), organizationId);
    return a;
  }

  async update(
    id: string,
    organizationId: string,
    data: { scheduledAt?: Date; notes?: string },
  ) {
    const existing = await this.findById(id, organizationId);
    if (!existing) return null;
    if (data.scheduledAt && existing.visitRecordedAt) {
      throw new BadRequestException(
        "Completed visits cannot be rescheduled through this workflow.",
      );
    }
    const db = getDb();
    const [updated] = await db
      .update(appointments)
      .set({
        ...(data.scheduledAt && { scheduledAt: new Date(data.scheduledAt) }),
        ...(data.scheduledAt && {
          status: "scheduled" as const,
          checkedInAt: null,
          needsReviewAt: null,
          completedAt: null,
          visitRecordedAt: null,
        }),
        ...(data.notes !== undefined && { notes: data.notes ?? null }),
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id))
      .returning(appointmentLegacySelect);
    return withVerificationCompatibility(updated!);
  }

  async updateStatus(
    id: string,
    organizationId: string,
    status: "scheduled" | "completed" | "missed" | "cancelled",
  ) {
    if (status === "completed") {
      return this.completeAppointmentAndRecordVisit(id, {
        organizationId,
        requireCheckedIn: false,
      });
    }

    const db = getDb();
    const [a] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, id))
      .limit(1);
    if (!a) throw new BadRequestException("Appointment not found.");
    await this.assertBusinessAccess(a.businessId, organizationId);
    const [updated] = await db
      .update(appointments)
      .set({
        status,
        ...(status === "missed" && { needsReviewAt: null }),
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id))
      .returning(appointmentLegacySelect);
    if (status === "missed") {
      void this.automationSend
        .sendMissedRecovery(organizationId, a.businessId, id)
        .catch(() => {});
    }
    return withVerificationCompatibility(updated!);
  }

  async markArrived(id: string, organizationId: string) {
    const existing = await this.findById(id, organizationId);
    if (!existing) throw new BadRequestException("Appointment not found.");

    if (!["scheduled", "needs_review"].includes(String(existing.status))) {
      throw new BadRequestException(
        "Only scheduled or needs-review appointments can be marked as arrived.",
      );
    }

    const db = getDb();
    const now = new Date();

    const [updated] = await db
      .update(appointments)
      .set({
        status: "checked_in",
        checkedInAt: now,
        needsReviewAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(appointments.id, id),
          inArray(appointments.status, ["scheduled", "needs_review"]),
        ),
      )
      .returning();

    return updated ?? null;
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
        reminder24hSentAt:
          (existing as { reminder24hSentAt?: Date | null }).reminder24hSentAt ?? now,
        updatedAt: now,
      })
      .where(eq(appointments.id, id))
      .returning(appointmentLegacySelect);
    return withVerificationCompatibility(updated!);
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

  async getAvailabilityForBooking(businessId: string, organizationId: string, month: string) {
    await this.assertBusinessAccess(businessId, organizationId);
    return this.intakeBookingService.getAvailability(businessId, month);
  }

  async createHoldForBooking(
    organizationId: string,
    data: { businessId: string; customerId: string; mobile: string; scheduledAt: string },
  ) {
    await this.assertBusinessAccess(data.businessId, organizationId);
    return this.intakeBookingService.createHold(data);
  }

  async sendBookingOtp(organizationId: string, holdId: string) {
    const db = getDb();
    const [hold] = await db.select().from(bookingHolds).where(eq(bookingHolds.id, holdId)).limit(1);
    if (!hold) throw new BadRequestException("Hold not found");
    await this.assertBusinessAccess(hold.businessId, organizationId);
    return this.intakeBookingService.sendOtp(holdId);
  }

  async verifyBookingOtp(organizationId: string, holdId: string, code: string) {
    const db = getDb();
    const [hold] = await db.select().from(bookingHolds).where(eq(bookingHolds.id, holdId)).limit(1);
    if (!hold) throw new BadRequestException("Hold not found");
    await this.assertBusinessAccess(hold.businessId, organizationId);
    return this.intakeBookingService.verifyAndConfirm(holdId, code.trim());
  }



  async getBookingSecurityStatus(businessId: string, organizationId: string) {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    try {
      const [settings] = await db
        .select({ businessId: bookingSecuritySettings.businessId })
        .from(bookingSecuritySettings)
        .where(eq(bookingSecuritySettings.businessId, businessId))
        .limit(1);
      return { pinConfigured: Boolean(settings) };
    } catch (error) {
      if (isBookingSecurityCompatibilityError(error)) {
        return { pinConfigured: false };
      }
      throw error;
    }
  }

  async setOtpSkipPin(input: {
    businessId: string;
    organizationId: string;
    actorUserId: string;
    actorRole: "owner" | "staff";
    pin: string;
  }) {
    if (input.actorRole !== "owner") throw new ForbiddenException("Owner only");
    if (!isValidOtpSkipPin(input.pin)) {
      throw new BadRequestException("PIN must be 4-8 digits.");
    }
    await this.assertBusinessAccess(input.businessId, input.organizationId);
    const db = getDb();
    const hash = hashOtpSkipPin(input.pin);
    try {
      await db
        .insert(bookingSecuritySettings)
        .values({
          businessId: input.businessId,
          otpSkipPinHash: hash,
          otpSkipPinSetByUserId: input.actorUserId,
        })
        .onConflictDoUpdate({
          target: bookingSecuritySettings.businessId,
          set: {
            otpSkipPinHash: hash,
            otpSkipPinSetByUserId: input.actorUserId,
            otpSkipPinSetAt: new Date(),
            updatedAt: new Date(),
          },
        });
    } catch (error) {
      if (isBookingSecurityCompatibilityError(error)) {
        throw new BadRequestException(
          "Booking security is not ready yet. Please run database setup/migrations and try again.",
        );
      }
      throw error;
    }
    return { success: true };
  }

  async confirmWithPinOverride(input: {
    holdId: string;
    businessId: string;
    organizationId: string;
    actorUserId: string;
    actorRole: "owner" | "staff";
    pin: string;
    reason: string;
    staffName?: string;
  }) {
    if (!input.reason.trim()) throw new BadRequestException("Skip reason required.");
    const business = await this.assertBusinessAccess(input.businessId, input.organizationId);
    const db = getDb();
    const lockoutSince = new Date(Date.now() - PIN_LOCKOUT_WINDOW_MINUTES * 60_000);
    let failedRows: Array<{ count: number }> = [];
    try {
      failedRows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(bookingPinAttemptLogs)
        .where(
          and(
            eq(bookingPinAttemptLogs.businessId, input.businessId),
            eq(bookingPinAttemptLogs.actorUserId, input.actorUserId),
            eq(bookingPinAttemptLogs.success, "false"),
            gte(bookingPinAttemptLogs.createdAt, lockoutSince),
          ),
        );
    } catch (error) {
      if (isBookingSecurityCompatibilityError(error)) {
        throw new BadRequestException(
          "Booking security is not ready yet. Please run database setup/migrations and try again.",
        );
      }
      throw error;
    }
    if ((failedRows[0]?.count ?? 0) >= PIN_MAX_ATTEMPTS) {
      throw new ForbiddenException("Too many failed PIN attempts. Please try again later.");
    }

    let settings:
      | (typeof bookingSecuritySettings.$inferSelect)
      | undefined;
    try {
      [settings] = await db
        .select()
        .from(bookingSecuritySettings)
        .where(eq(bookingSecuritySettings.businessId, input.businessId))
        .limit(1);
    } catch (error) {
      if (isBookingSecurityCompatibilityError(error)) {
        throw new BadRequestException(
          "Booking security is not ready yet. Please run database setup/migrations and try again.",
        );
      }
      throw error;
    }
    if (!settings) throw new BadRequestException("Manager PIN is not configured.");
    const expected = Buffer.from(settings.otpSkipPinHash, "hex");
    const actualHash = hashOtpSkipPin(input.pin.trim());
    const actual = Buffer.from(actualHash, "hex");
    const isPinCorrect = expected.length === actual.length && timingSafeEqual(expected, actual);

    try {
      await db.insert(bookingPinAttemptLogs).values({
        businessId: input.businessId,
        actorUserId: input.actorUserId,
        success: isPinCorrect ? "true" : "false",
      });
    } catch (error) {
      if (isBookingSecurityCompatibilityError(error)) {
        throw new BadRequestException(
          "Booking security is not ready yet. Please run database setup/migrations and try again.",
        );
      }
      throw error;
    }
    if (!isPinCorrect) throw new ForbiddenException("Invalid manager PIN.");

    const [hold] = await db.select().from(bookingHolds).where(eq(bookingHolds.id, input.holdId)).limit(1);
    if (!hold) throw new BadRequestException("Hold not found");
    if (hold.businessId !== input.businessId) throw new ForbiddenException("Hold mismatch");
    if (!["held", "confirmed"].includes(hold.status)) throw new BadRequestException("Hold is not active");
    if (hold.expiresAt < new Date()) throw new BadRequestException("Hold expired");

    const [existingAppt] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.businessId, input.businessId),
          eq(appointments.scheduledAt, hold.scheduledAt),
          inArray(appointments.status, ["scheduled"]),
        ),
      )
      .limit(1);
    if (existingAppt) throw new BadRequestException("Selected slot is no longer available");

    const [created] = await db
      .insert(appointments)
      .values({
        businessId: hold.businessId,
        customerId: hold.customerId,
        scheduledAt: hold.scheduledAt,
        durationMinutes: appointmentDurationMinutesForBusinessType(
          business.businessType,
        ),
        status: "scheduled",
        staffName: input.staffName ?? null,
        verificationMode: "pin_override",
        otpSkipReason: input.reason.trim(),
        verifiedByUserId: input.actorUserId,
        verifiedAt: new Date(),
      })
      .returning();

    await db
      .update(bookingHolds)
      .set({ status: "confirmed", confirmedAt: new Date(), updatedAt: new Date() })
      .where(eq(bookingHolds.id, hold.id));

    return { appointment: created };
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
    return biz;
  }

  async listNeedsReview(
    businessId: string,
    organizationId: string,
    limit = 50,
  ) {
    await this.assertBusinessAccess(businessId, organizationId);

    const db = getDb();

    return db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.businessId, businessId),
          eq(appointments.status, "needs_review"),
        ),
      )
      .orderBy(desc(appointments.scheduledAt))
      .limit(Math.min(limit, 100));
  }

  async reconcileVisitLifecycle(now = new Date()) {
    const db = getDb();

    const candidates = await db
      .select()
      .from(appointments)
      .where(
        and(
          inArray(appointments.status, ["scheduled", "checked_in"]),
          lte(appointments.scheduledAt, now),
        ),
      )
      .limit(500);

    let completed = 0;
    let needsReview = 0;

    for (const appointment of candidates) {
      try {
        const dueAt = appointmentLifecycleDueAt(
          appointment.scheduledAt,
          appointment.durationMinutes,
        );

        if (dueAt > now) continue;

        if (appointment.status === "checked_in") {
          const updated = await this.completeAppointmentAndRecordVisit(
            appointment.id,
            { requireCheckedIn: true },
          );

          if (updated) completed += 1;
          continue;
        }

        const [updated] = await db
          .update(appointments)
          .set({
            status: "needs_review",
            needsReviewAt: now,
            updatedAt: now,
          })
          .where(
            and(
              eq(appointments.id, appointment.id),
              eq(appointments.status, "scheduled"),
            ),
          )
          .returning({ id: appointments.id });

        if (updated) needsReview += 1;
      } catch (error) {
        this.logger.error(
          `Failed to reconcile appointment ${appointment.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    return { completed, needsReview };
  }

  private async completeAppointmentAndRecordVisit(
    id: string,
    options: {
      organizationId?: string;
      requireCheckedIn: boolean;
    },
  ) {
    const db = getDb();
    const now = new Date();

    const result = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select ${appointments.id}
            from ${appointments}
            where ${appointments.id} = ${id}
            for update`,
      );

      const [appointment] = await tx
        .select()
        .from(appointments)
        .where(eq(appointments.id, id))
        .limit(1);

      if (!appointment) throw new BadRequestException("Appointment not found.");

      const [business] = await tx
        .select({
          organizationId: businesses.organizationId,
        })
        .from(businesses)
        .where(eq(businesses.id, appointment.businessId))
        .limit(1);

      if (!business?.organizationId) {
        throw new BadRequestException("Appointment business not found.");
      }

      if (
        options.organizationId &&
        business.organizationId !== options.organizationId
      ) {
        throw new ForbiddenException("Business not found");
      }

      if (options.requireCheckedIn && appointment.status !== "checked_in") {
        return null;
      }

      if (["cancelled", "missed"].includes(appointment.status)) {
        throw new BadRequestException(
          "Cancelled or missed appointments cannot be completed.",
        );
      }

      if (appointment.status === "completed" || appointment.visitRecordedAt) {
        return {
          appointment,
          newlyRecorded: false,
          businessId: appointment.businessId,
          organizationId: business.organizationId,
          customerId: appointment.customerId,
          visitCount: null,
        };
      }

      const [customer] = await tx
        .update(customers)
        .set({
          visitCount: sql`${customers.visitCount} + 1`,
          lastVisitAt: now,
          updatedAt: now,
        })
        .where(eq(customers.id, appointment.customerId))
        .returning({ visitCount: customers.visitCount });

      if (!customer) {
        throw new BadRequestException("Customer not found.");
      }

      const [updated] = await tx
        .update(appointments)
        .set({
          status: "completed",
          completedAt: appointment.completedAt ?? now,
          visitRecordedAt: now,
          needsReviewAt: null,
          updatedAt: now,
        })
        .where(eq(appointments.id, id))
        .returning();

      return {
        appointment: updated!,
        newlyRecorded: true,
        businessId: appointment.businessId,
        organizationId: business.organizationId,
        customerId: appointment.customerId,
        visitCount: customer.visitCount,
      };
    });

    if (!result) return null;

    if (result.newlyRecorded) {
      void this.automationSend
        .sendPostVisitFollowup(
          result.organizationId,
          result.businessId,
          result.customerId,
        )
        .catch(() => {});

      if ((result.visitCount ?? 0) >= 5) {
        void this.automationSend
          .sendLoyaltyUnlock(
            result.organizationId,
            result.businessId,
            result.customerId,
          )
          .catch(() => {});
      }
    }

    return result.appointment;
  }
}
