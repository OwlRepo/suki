import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { getDb } from "@tyvera/database";
import {
  appointments,
  bookingHolds,
  businesses,
  publicOtpSendEvents,
  verifiedOnlineBookingCredits,
  verifiedOnlineBookingUsageEvents,
} from "@tyvera/database";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import {
  PH_MOBILE_E164_ERROR,
  normalizePhilippineMobileE164,
} from "@tyvera/types";
import { AutomationSendService } from "../automation/automation-send.service";
import { OrgBillingStateService } from "../common/org-billing-state.service";
import { getPlanCatalogEntry } from "../billing/plan-catalog";

const HOLD_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_WINDOW_MS = 60_000;
const SAFE_BOOKING_UNAVAILABLE_MESSAGE =
  "Online booking verification is temporarily unavailable. Please contact the business directly.";

type OtpConfig = {
  resendCooldownSeconds: number;
  maxSendsPerHold: number;
  perMobileLimit: number;
  perMobileWindowMinutes: number;
  perIpLimit: number;
  perIpWindowMinutes: number;
  perBusinessDailyLimit: number;
};

type VerifyResult = {
  sid?: string;
  status?: string;
  valid?: boolean;
};

type DatabaseLikeError = {
  code?: string;
  message?: string;
};

export function isBookingHoldsCompatibilityError(error: unknown): boolean {
  const candidate = error as DatabaseLikeError | undefined;
  const message = String(candidate?.message ?? "").toLowerCase();

  // PostgreSQL 42P01 = undefined_table, 42703 = undefined_column.
  return (
    candidate?.code === "42P01" ||
    candidate?.code === "42703" ||
    (message.includes("booking_holds") &&
      (message.includes("does not exist") ||
        message.includes("undefined column") ||
        message.includes("relation")))
  );
}

@Injectable()
export class IntakeBookingService {
  private readonly logger = new Logger(IntakeBookingService.name);

  constructor(
    private readonly automationSend: AutomationSendService,
    private readonly orgBillingState: OrgBillingStateService,
  ) {}

  async getAvailability(businessId: string, month: string) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException("month must be YYYY-MM");
    }

    const [year, monthNum] = month.split("-").map((v) => parseInt(v, 10));
    const start = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59));

    const db = getDb();
    const [biz] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);

    if (!biz) {
      throw new BadRequestException("Business not found");
    }

    const slotDurationMins = biz.businessType === "clinic" ? 60 : 30;
    const startHour = biz.businessType === "clinic" ? 9 : 10;
    const endHour = biz.businessType === "clinic" ? 17 : 20;

    const appts = await db
      .select({ scheduledAt: appointments.scheduledAt })
      .from(appointments)
      .where(
        and(
          eq(appointments.businessId, businessId),
          eq(appointments.status, "scheduled"),
          gte(appointments.scheduledAt, start),
          lte(appointments.scheduledAt, end),
        ),
      );

    const now = new Date();
    let activeHolds: Array<{ scheduledAt: Date }> = [];

    try {
      activeHolds = await db
        .select({ scheduledAt: bookingHolds.scheduledAt })
        .from(bookingHolds)
        .where(
          and(
            eq(bookingHolds.businessId, businessId),
            inArray(bookingHolds.status, ["held", "confirmed"]),
            gte(bookingHolds.expiresAt, now),
            gte(bookingHolds.scheduledAt, start),
            lte(bookingHolds.scheduledAt, end),
          ),
        );
    } catch (error) {
      if (isBookingHoldsCompatibilityError(error)) {
        this.logger.warn(
          `Booking holds compatibility fallback in getAvailability for businessId=${businessId}. Ensure migration 0018_booking_holds is applied.`,
        );
      } else {
        throw new InternalServerErrorException("Failed to load availability");
      }
    }

    const blocked = new Set<string>();

    for (const a of appts) {
      blocked.add(a.scheduledAt.toISOString());
    }

    for (const h of activeHolds) {
      blocked.add(h.scheduledAt.toISOString());
    }

    const byDay: Record<string, string[]> = {};
    const startLocal = new Date(year, monthNum - 1, 1);
    const endLocal = new Date(year, monthNum, 0);

    for (
      let d = new Date(startLocal);
      d <= endLocal;
      d.setDate(d.getDate() + 1)
    ) {
      const day = new Date(d);
      const dayKey = day.toISOString().slice(0, 10);
      const daySlots: string[] = [];

      for (let hour = startHour; hour < endHour; hour += 1) {
        for (let mins = 0; mins < 60; mins += slotDurationMins) {
          const slot = new Date(
            day.getFullYear(),
            day.getMonth(),
            day.getDate(),
            hour,
            mins,
            0,
            0,
          );

          if (slot <= now) {
            continue;
          }

          if (!blocked.has(slot.toISOString())) {
            daySlots.push(slot.toISOString());
          }
        }
      }

      if (daySlots.length > 0) {
        byDay[dayKey] = daySlots;
      }
    }

    return {
      month,
      slotDurationMins,
      byDay,
    };
  }

  async createHold(input: {
    businessId: string;
    customerId: string;
    mobile: string;
    scheduledAt: string;
  }) {
    const scheduledAt = new Date(input.scheduledAt);

    if (!Number.isFinite(scheduledAt.getTime())) {
      throw new BadRequestException("Invalid scheduledAt");
    }

    if (!input.mobile?.trim()) {
      throw new BadRequestException("mobile required");
    }

    const mobile = normalizePhilippineMobileE164(input.mobile);

    if (!mobile) {
      throw new BadRequestException(PH_MOBILE_E164_ERROR);
    }

    const db = getDb();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + HOLD_MINUTES * 60_000);

    const hold = await db.transaction(async (tx) => {
      const lockKey = `${input.businessId}:${scheduledAt.toISOString()}`;

      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`,
      );

      const existingAppt = await tx
        .select({ id: appointments.id })
        .from(appointments)
        .where(
          and(
            eq(appointments.businessId, input.businessId),
            eq(appointments.scheduledAt, scheduledAt),
            eq(appointments.status, "scheduled"),
          ),
        )
        .limit(1);

      if (existingAppt.length > 0) {
        throw new ConflictException("Selected slot is no longer available");
      }

      const existingHold = await tx
        .select({ id: bookingHolds.id })
        .from(bookingHolds)
        .where(
          and(
            eq(bookingHolds.businessId, input.businessId),
            eq(bookingHolds.scheduledAt, scheduledAt),
            inArray(bookingHolds.status, ["held", "confirmed"]),
            gte(bookingHolds.expiresAt, now),
          ),
        )
        .limit(1);

      if (existingHold.length > 0) {
        throw new ConflictException("Selected slot is currently held");
      }

      const [created] = await tx
        .insert(bookingHolds)
        .values({
          businessId: input.businessId,
          customerId: input.customerId,
          mobile,
          scheduledAt,
          status: "held",
          expiresAt,
        })
        .returning();

      return created!;
    });

    return hold;
  }

  async sendOtp(holdId: string, clientIp?: string) {
    const db = getDb();
    const otpConfig = this.getOtpConfigFromEnv();

    const [hold] = await db
      .select()
      .from(bookingHolds)
      .where(eq(bookingHolds.id, holdId))
      .limit(1);

    if (!hold) {
      throw new BadRequestException("Hold not found");
    }

    if (hold.status !== "held") {
      throw new BadRequestException("Hold is not active");
    }

    if (hold.expiresAt < new Date()) {
      throw new BadRequestException("Hold expired");
    }

    if (
      hold.otpCooldownEndsAt &&
      hold.otpCooldownEndsAt instanceof Date &&
      hold.otpCooldownEndsAt.getTime() > Date.now()
    ) {
      throw this.buildPublicOtpError(
        "OTP_RESEND_COOLDOWN",
        SAFE_BOOKING_UNAVAILABLE_MESSAGE,
      );
    }

    if ((hold.otpSentCount ?? 0) >= otpConfig.maxSendsPerHold) {
      throw this.buildPublicOtpError(
        "OTP_HOLD_SEND_LIMIT",
        SAFE_BOOKING_UNAVAILABLE_MESSAGE,
      );
    }

    if (
      hold.otpSid &&
      hold.updatedAt &&
      Date.now() - hold.updatedAt.getTime() < OTP_RESEND_WINDOW_MS
    ) {
      return {
        success: true,
        reused: true,
        holdExpiresAt: hold.expiresAt.toISOString(),
        resendAvailableAt: hold.updatedAt
          ? new Date(hold.updatedAt.getTime() + OTP_RESEND_WINDOW_MS).toISOString()
          : new Date(Date.now() + OTP_RESEND_WINDOW_MS).toISOString(),
        sendsRemaining: Math.max(0, otpConfig.maxSendsPerHold - (hold.otpSentCount ?? 1)),
      };
    }

    const [business] = await db
      .select({
        organizationId: businesses.organizationId,
      })
      .from(businesses)
      .where(eq(businesses.id, hold.businessId))
      .limit(1);

    if (!business?.organizationId) {
      throw new BadRequestException("Business not found");
    }

    const state = await this.orgBillingState.getOrgBillingState(
      business.organizationId,
    );
    if (state?.variableCostActionsBlocked) {
      throw this.buildPublicOtpError(
        "OTP_BILLING_BLOCKED",
        SAFE_BOOKING_UNAVAILABLE_MESSAGE,
      );
    }

    const creditLedger = await this.ensureVerifiedBookingCredits(
      business.organizationId,
      state?.currentPlan ?? "free",
    );
    if (creditLedger.used >= creditLedger.includedGranted + creditLedger.addonGranted) {
      throw this.buildPublicOtpError(
        "OTP_BILLING_BLOCKED",
        SAFE_BOOKING_UNAVAILABLE_MESSAGE,
      );
    }

    await this.assertOtpSendAllowed({
      hold,
      clientIp,
      otpConfig,
    });

    const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const token = process.env.TWILIO_AUTH_TOKEN?.trim();
    const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();

    if (!sid || !token || !verifyServiceSid) {
      throw new BadRequestException("OTP provider not configured");
    }

    const basicAuth = Buffer.from(`${sid}:${token}`).toString("base64");
    const params = new URLSearchParams();

    params.set("To", hold.mobile);
    params.set("Channel", "sms");

    const res = await fetch(
      `https://verify.twilio.com/v2/Services/${verifyServiceSid}/Verifications`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
    );

    if (!res.ok) {
      throw this.buildPublicOtpError(
        "OTP_PROVIDER_UNAVAILABLE",
        SAFE_BOOKING_UNAVAILABLE_MESSAGE,
      );
    }

    const data = (await res.json()) as VerifyResult;
    const now = new Date();
    const resendAvailableAt = new Date(now.getTime() + otpConfig.resendCooldownSeconds * 1000);

    await db
      .update(bookingHolds)
      .set({
        otpSid: data.sid ?? null,
        otpSentCount: (hold.otpSentCount ?? 0) + 1,
        otpLastSentAt: now,
        otpCooldownEndsAt: resendAvailableAt,
        otpSendWindowKey:
          hold.otpSendWindowKey ??
          `${hold.id}:${Math.floor(now.getTime() / OTP_RESEND_WINDOW_MS)}`,
        updatedAt: now,
      })
      .where(eq(bookingHolds.id, hold.id));

    await db
      .update(verifiedOnlineBookingCredits)
      .set({
        used: creditLedger.used + 1,
        updatedAt: new Date(),
      })
      .where(eq(verifiedOnlineBookingCredits.organizationId, business.organizationId));

    await db.insert(verifiedOnlineBookingUsageEvents).values({
      organizationId: business.organizationId,
      businessId: hold.businessId,
      bookingHoldId: hold.id,
      units: 1,
      status: "consumed",
      provider: "twilio_verify",
      providerVerificationSid: data.sid ?? null,
    });

    await this.recordOtpSendEvent({
      organizationId: business.organizationId,
      businessId: hold.businessId,
      bookingHoldId: hold.id,
      mobile: hold.mobile,
      ipAddress: this.resolveClientIp(clientIp),
      outcome: "sent",
      providerVerificationSid: data.sid ?? null,
    });

    return {
      success: true,
      reused: false,
      holdExpiresAt: hold.expiresAt.toISOString(),
      resendAvailableAt: resendAvailableAt.toISOString(),
      sendsRemaining: Math.max(0, otpConfig.maxSendsPerHold - ((hold.otpSentCount ?? 0) + 1)),
    };
  }

  async verifyAndConfirm(holdId: string, code: string) {
    if (!code?.trim()) {
      throw new BadRequestException("OTP code required");
    }

    const db = getDb();

    const [hold] = await db
      .select()
      .from(bookingHolds)
      .where(eq(bookingHolds.id, holdId))
      .limit(1);

    if (!hold) {
      throw new BadRequestException("Hold not found");
    }

    if (hold.status !== "held") {
      throw new BadRequestException("Hold is not active");
    }

    if (hold.expiresAt < new Date()) {
      await db
        .update(bookingHolds)
        .set({
          status: "expired",
          updatedAt: new Date(),
        })
        .where(eq(bookingHolds.id, hold.id));

      throw new BadRequestException("Hold expired");
    }

    if (hold.otpAttempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException("Too many OTP attempts");
    }

    const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const token = process.env.TWILIO_AUTH_TOKEN?.trim();
    const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();

    if (!sid || !token || !verifyServiceSid) {
      throw new BadRequestException("OTP provider not configured");
    }

    const basicAuth = Buffer.from(`${sid}:${token}`).toString("base64");
    const params = new URLSearchParams();

    params.set("To", hold.mobile);
    params.set("Code", code.trim());

    const verifyRes = await fetch(
      `https://verify.twilio.com/v2/Services/${verifyServiceSid}/VerificationCheck`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
    );

    const verifyData = (await verifyRes
      .json()
      .catch(() => ({}))) as VerifyResult;

    if (!verifyRes.ok || !verifyData.valid) {
      await db
        .update(bookingHolds)
        .set({
          otpAttempts: hold.otpAttempts + 1,
          updatedAt: new Date(),
        })
        .where(eq(bookingHolds.id, hold.id));

      throw new BadRequestException("Invalid OTP");
    }

    const appointment = await db.transaction(async (tx) => {
      const lockKey = `${hold.businessId}:${hold.scheduledAt.toISOString()}`;

      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`,
      );

      const conflictingAppointment = await tx
        .select({ id: appointments.id })
        .from(appointments)
        .where(
          and(
            eq(appointments.businessId, hold.businessId),
            eq(appointments.scheduledAt, hold.scheduledAt),
            eq(appointments.status, "scheduled"),
          ),
        )
        .limit(1);

      if (conflictingAppointment.length > 0) {
        throw new ConflictException("Selected slot is no longer available");
      }

      const [createdAppointment] = await tx
        .insert(appointments)
        .values({
          businessId: hold.businessId,
          customerId: hold.customerId,
          scheduledAt: hold.scheduledAt,
          notes: "Booked via customer self-serve flow",
          status: "scheduled",
        })
        .returning();

      await tx
        .update(bookingHolds)
        .set({
          status: "confirmed",
          confirmedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(bookingHolds.id, hold.id));

      return createdAppointment!;
    });

    const [business] = await db
      .select({
        organizationId: businesses.organizationId,
      })
      .from(businesses)
      .where(eq(businesses.id, appointment.businessId))
      .limit(1);

    if (business) {
      void this.automationSend
        .sendAppointmentConfirmation(
          business.organizationId,
          appointment.businessId,
          appointment.id,
        )
        .catch(() => {});
    }

    return {
      appointment,
      success: true,
    };
  }

  private async ensureVerifiedBookingCredits(
    organizationId: string,
    planType: "free" | "starter" | "growth" | "pro",
  ) {
    const db = getDb();
    const month = this.getCurrentMonthUtcKey();
    const [ledger] = await db
      .select()
      .from(verifiedOnlineBookingCredits)
      .where(eq(verifiedOnlineBookingCredits.organizationId, organizationId))
      .limit(1);

    if (ledger?.month === month) {
      return ledger;
    }

    const includedGranted =
      getPlanCatalogEntry(planType).limits.verifiedOnlineBookingsPerMonth;
    const nextLedger = {
      organizationId,
      month,
      includedGranted,
      addonGranted: 0,
      used: 0,
      sourcePlan: planType,
      lastReconciledAt: new Date(),
    };

    await db.insert(verifiedOnlineBookingCredits).values(nextLedger);
    return nextLedger;
  }

  private getCurrentMonthUtcKey(): string {
    return this.toMonthKey(new Date());
  }

  private async assertOtpSendAllowed(input: {
    hold: {
      businessId: string;
      mobile: string;
    };
    clientIp?: string;
    otpConfig: OtpConfig;
  }) {
    const db = getDb();
    const now = Date.now();
    const ipAddress = this.resolveClientIp(input.clientIp);

    const mobileEvents =
      ((await db
        .select()
        .from(publicOtpSendEvents)
        .where(eq(publicOtpSendEvents.mobile, input.hold.mobile))
        .limit(input.otpConfig.perMobileLimit + 20)) as Array<{
        createdAt?: Date | null;
        outcome?: string | null;
      }> | undefined) ?? [];
    const mobileWindowStart = now - input.otpConfig.perMobileWindowMinutes * 60_000;
    const mobileCount = mobileEvents.filter(
      (event) =>
        event.outcome === "sent" &&
        event.createdAt instanceof Date &&
        event.createdAt.getTime() >= mobileWindowStart,
    ).length;
    if (mobileCount >= input.otpConfig.perMobileLimit) {
      throw this.buildPublicOtpError(
        "OTP_MOBILE_RATE_LIMIT",
        "Too many verification attempts were requested. Please try again later.",
      );
    }

    if (ipAddress) {
      const ipEvents =
        ((await db
          .select()
          .from(publicOtpSendEvents)
          .where(eq(publicOtpSendEvents.ipAddress, ipAddress))
          .limit(input.otpConfig.perIpLimit + 20)) as Array<{
          createdAt?: Date | null;
          outcome?: string | null;
        }> | undefined) ?? [];
      const ipWindowStart = now - input.otpConfig.perIpWindowMinutes * 60_000;
      const ipCount = ipEvents.filter(
        (event) =>
          event.outcome === "sent" &&
          event.createdAt instanceof Date &&
          event.createdAt.getTime() >= ipWindowStart,
      ).length;
      if (ipCount >= input.otpConfig.perIpLimit) {
        throw this.buildPublicOtpError(
          "OTP_IP_RATE_LIMIT",
          "Too many verification attempts were requested. Please try again later.",
        );
      }
    }

    const businessEvents =
      ((await db
        .select()
        .from(publicOtpSendEvents)
        .where(eq(publicOtpSendEvents.businessId, input.hold.businessId))
        .limit(input.otpConfig.perBusinessDailyLimit + 50)) as Array<{
        createdAt?: Date | null;
        outcome?: string | null;
      }> | undefined) ?? [];
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const businessCount = businessEvents.filter(
      (event) =>
        event.outcome === "sent" &&
        event.createdAt instanceof Date &&
        event.createdAt.getTime() >= dayStart.getTime(),
    ).length;
    if (businessCount >= input.otpConfig.perBusinessDailyLimit) {
      throw this.buildPublicOtpError(
        "OTP_BUSINESS_DAILY_LIMIT",
        "Too many verification attempts were requested. Please try again later.",
      );
    }
  }

  private resolveClientIp(clientIp?: string): string | null {
    const normalized = clientIp?.trim();
    return normalized ? normalized.slice(0, 128) : null;
  }

  private async recordOtpSendEvent(input: {
    organizationId: string;
    businessId: string;
    bookingHoldId: string;
    mobile: string;
    ipAddress: string | null;
    outcome: string;
    providerVerificationSid: string | null;
  }) {
    const db = getDb();
    await db.insert(publicOtpSendEvents).values({
      organizationId: input.organizationId,
      businessId: input.businessId,
      bookingHoldId: input.bookingHoldId,
      mobile: input.mobile,
      ipAddress: input.ipAddress,
      outcome: input.outcome,
      provider: "twilio_verify",
      providerVerificationSid: input.providerVerificationSid,
      metadata: null,
    });
  }

  private buildPublicOtpError(code: string, message: string) {
    return new BadRequestException({
      code,
      message,
    });
  }

  private getOtpConfigFromEnv(): OtpConfig {
    return {
      resendCooldownSeconds: Math.max(
        0,
        Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 60) || 60,
      ),
      maxSendsPerHold: Math.max(
        1,
        Number(process.env.OTP_MAX_SENDS_PER_HOLD ?? 3) || 3,
      ),
      perMobileLimit: Math.max(
        1,
        Number(process.env.OTP_PER_MOBILE_LIMIT ?? 5) || 5,
      ),
      perMobileWindowMinutes: Math.max(
        1,
        Number(process.env.OTP_PER_MOBILE_WINDOW_MINUTES ?? 60) || 60,
      ),
      perIpLimit: Math.max(
        1,
        Number(process.env.OTP_PER_IP_LIMIT ?? 10) || 10,
      ),
      perIpWindowMinutes: Math.max(
        1,
        Number(process.env.OTP_PER_IP_WINDOW_MINUTES ?? 60) || 60,
      ),
      perBusinessDailyLimit: Math.max(
        1,
        Number(process.env.OTP_PER_BUSINESS_DAILY_LIMIT ?? 100) || 100,
      ),
    };
  }

  private toMonthKey(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }
}
