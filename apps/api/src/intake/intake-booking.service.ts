import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  Optional,
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
import { appointmentDurationMinutesForBusinessType } from "../common/appointment-timing";
import { OrgBillingStateService } from "../common/org-billing-state.service";
import { getPlanCatalogEntry } from "../billing/plan-catalog";
import { OtpFailoverService } from "./otp/otp-failover.service";
import { OtpProviderSettingsService } from "./otp/otp-provider-settings.service";
import { SemaphoreOtpProvider } from "./otp/semaphore-otp.provider";
import { TwilioVerifyOtpProvider } from "./otp/twilio-verify-otp.provider";
import type { IOtpProvider, SendOtpResult } from "./otp/otp-provider";
import { SEMAPHORE_OTP_PROVIDER, TWILIO_OTP_PROVIDER } from "./otp/otp-provider.tokens";

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
    private readonly otpFailover: OtpFailoverService = new OtpFailoverService(
      new TwilioVerifyOtpProvider(),
      new SemaphoreOtpProvider(),
      new OtpProviderSettingsService(),
    ),
    @Optional()
    @Inject(TWILIO_OTP_PROVIDER)
    private readonly twilioOtpProvider: IOtpProvider = new TwilioVerifyOtpProvider(),
    @Optional()
    @Inject(SEMAPHORE_OTP_PROVIDER)
    private readonly semaphoreOtpProvider: IOtpProvider = new SemaphoreOtpProvider(),
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

    const slotDurationMins = appointmentDurationMinutesForBusinessType(
      biz.businessType,
    );
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

    if (
      hold.otpCooldownEndsAt &&
      hold.otpCooldownEndsAt instanceof Date &&
      hold.otpCooldownEndsAt.getTime() > Date.now()
    ) {
      await this.recordBlockedOtpSendEvent({
        organizationId: business.organizationId,
        hold,
        clientIp,
        outcome: "OTP_RESEND_COOLDOWN",
      });
      throw this.buildPublicOtpError(
        "OTP_RESEND_COOLDOWN",
        SAFE_BOOKING_UNAVAILABLE_MESSAGE,
      );
    }

    if ((hold.otpSentCount ?? 0) >= otpConfig.maxSendsPerHold) {
      await this.recordBlockedOtpSendEvent({
        organizationId: business.organizationId,
        hold,
        clientIp,
        outcome: "OTP_HOLD_SEND_LIMIT",
      });
      throw this.buildPublicOtpError(
        "OTP_HOLD_SEND_LIMIT",
        SAFE_BOOKING_UNAVAILABLE_MESSAGE,
      );
    }

    if (
      this.hasReusableOtpChallenge(hold) &&
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

    const state = await this.orgBillingState.getOrgBillingState(
      business.organizationId,
    );
    if (state?.variableCostActionsBlocked) {
      await this.recordBlockedOtpSendEvent({
        organizationId: business.organizationId,
        hold,
        clientIp,
        outcome: "OTP_BILLING_BLOCKED",
      });
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
      await this.recordBlockedOtpSendEvent({
        organizationId: business.organizationId,
        hold,
        clientIp,
        outcome: "OTP_BILLING_BLOCKED",
      });
      throw this.buildPublicOtpError(
        "OTP_BILLING_BLOCKED",
        SAFE_BOOKING_UNAVAILABLE_MESSAGE,
      );
    }

    await this.assertOtpSendAllowed({
      hold,
      clientIp,
      organizationId: business.organizationId,
      otpConfig,
    });

    const otpResult = await this.otpFailover.sendOtp({
      organizationId: business.organizationId,
      mobile: hold.mobile,
    });

    if (!otpResult.ok) {
      await this.recordBlockedOtpSendEvent({
        organizationId: business.organizationId,
        hold,
        clientIp,
        outcome: "OTP_PROVIDER_UNAVAILABLE",
        provider: this.toOtpAuditProvider(otpResult.provider),
        providerVerificationSid: otpResult.providerMessageId ?? null,
        metadata: otpResult.providerMetadata ?? null,
      });
      throw this.buildPublicOtpError(
        "OTP_PROVIDER_UNAVAILABLE",
        SAFE_BOOKING_UNAVAILABLE_MESSAGE,
      );
    }

    const now = new Date();
    const resendAvailableAt = new Date(now.getTime() + otpConfig.resendCooldownSeconds * 1000);
    const holdUpdate = this.buildOtpHoldUpdate(otpResult, hold, now, resendAvailableAt);

    await db
      .update(bookingHolds)
      .set(holdUpdate)
      .where(eq(bookingHolds.id, hold.id));

    await db
      .update(verifiedOnlineBookingCredits)
      .set({
        used: creditLedger.used + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(verifiedOnlineBookingCredits.organizationId, business.organizationId),
          eq(verifiedOnlineBookingCredits.month, creditLedger.month),
        ),
      );

    await db.insert(verifiedOnlineBookingUsageEvents).values({
      organizationId: business.organizationId,
      businessId: hold.businessId,
      bookingHoldId: hold.id,
      units: 1,
      status: "consumed",
      provider: this.toOtpAuditProvider(otpResult.provider),
      providerVerificationSid: otpResult.providerMessageId ?? null,
    });

    await this.recordOtpSendEvent({
      organizationId: business.organizationId,
      businessId: hold.businessId,
      bookingHoldId: hold.id,
      mobile: hold.mobile,
      ipAddress: this.resolveClientIp(clientIp),
      outcome: "sent",
      provider: this.toOtpAuditProvider(otpResult.provider),
      providerVerificationSid: otpResult.providerMessageId ?? null,
      metadata: otpResult.providerMetadata ?? null,
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
      throw this.buildPublicOtpError("OTP_INVALID_CODE", "OTP code required");
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

      throw this.buildPublicOtpError("OTP_HOLD_EXPIRED", "Hold expired");
    }

    if (hold.otpAttempts >= OTP_MAX_ATTEMPTS) {
      throw this.buildPublicOtpError(
        "OTP_MAX_ATTEMPTS",
        "Too many OTP attempts",
      );
    }

    const otpProvider = hold.otpProvider === "semaphore" ? "semaphore" : "twilio";
    const verifyData =
      otpProvider === "semaphore"
        ? await this.semaphoreOtpProvider.verify({
            mobile: hold.mobile,
            code: code.trim(),
            storedCodeHash: hold.otpCodeHash,
            codeExpiresAt: hold.otpCodeExpiresAt,
          })
        : await this.twilioOtpProvider.verify({
            mobile: hold.mobile,
            code: code.trim(),
          });

    if (verifyData.errorCode === "OTP_PROVIDER_UNAVAILABLE") {
      throw this.buildPublicOtpError(
        "OTP_PROVIDER_UNAVAILABLE",
        "OTP provider temporarily unavailable",
      );
    }
    if (verifyData.errorCode === "OTP_HOLD_EXPIRED") {
      throw this.buildPublicOtpError("OTP_HOLD_EXPIRED", "Hold expired");
    }

    if (!verifyData.valid) {
      await db
        .update(bookingHolds)
        .set({
          otpAttempts: hold.otpAttempts + 1,
          updatedAt: new Date(),
        })
        .where(eq(bookingHolds.id, hold.id));

      throw this.buildPublicOtpError("OTP_INVALID_CODE", "Invalid OTP");
    }

    const [appointmentBusiness] = await db
      .select({
        organizationId: businesses.organizationId,
        businessType: businesses.businessType,
      })
      .from(businesses)
      .where(eq(businesses.id, hold.businessId))
      .limit(1);

    if (!appointmentBusiness?.organizationId) {
      throw new BadRequestException("Business not found");
    }

    let appointment: {
      id: string;
      businessId: string;
    };
    try {
      appointment = await db.transaction(async (tx) => {
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
            durationMinutes: appointmentDurationMinutesForBusinessType(
              appointmentBusiness.businessType,
            ),
            notes: "Booked via customer self-serve flow",
            status: "scheduled",
          })
          .returning();

        await tx
          .update(bookingHolds)
          .set({
            status: "confirmed",
            confirmedAt: new Date(),
            otpCodeHash: null,
            otpCodeExpiresAt: null,
            updatedAt: new Date(),
          })
          .where(eq(bookingHolds.id, hold.id));

        return createdAppointment!;
      }) as {
        id: string;
        businessId: string;
      };
    } catch (err) {
      if (
        err instanceof ConflictException ||
        (err instanceof Error && /slot is no longer available/i.test(err.message))
      ) {
        throw this.buildPublicOtpError(
          "OTP_SLOT_CONFLICT",
          "Selected slot is no longer available",
        );
      }
      throw err;
    }

    if (appointmentBusiness) {
      void this.automationSend
        .sendAppointmentConfirmation(
          appointmentBusiness.organizationId,
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
      .where(
        and(
          eq(verifiedOnlineBookingCredits.organizationId, organizationId),
          eq(verifiedOnlineBookingCredits.month, month),
        ),
      )
      .limit(1);

    if (ledger) {
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
      id: string;
      businessId: string;
      mobile: string;
    };
    clientIp?: string;
    organizationId: string;
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
      await this.recordBlockedOtpSendEvent({
        organizationId: input.organizationId,
        hold: input.hold,
        clientIp: input.clientIp,
        outcome: "OTP_MOBILE_RATE_LIMIT",
      });
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
        await this.recordBlockedOtpSendEvent({
          organizationId: input.organizationId,
          hold: input.hold,
          clientIp: input.clientIp,
          outcome: "OTP_IP_RATE_LIMIT",
        });
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
      await this.recordBlockedOtpSendEvent({
        organizationId: input.organizationId,
        hold: input.hold,
        clientIp: input.clientIp,
        outcome: "OTP_BUSINESS_DAILY_LIMIT",
      });
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
    provider?: string;
    providerVerificationSid: string | null;
    metadata?: Record<string, unknown> | null;
  }) {
    const db = getDb();
    await db.insert(publicOtpSendEvents).values({
      organizationId: input.organizationId,
      businessId: input.businessId,
      bookingHoldId: input.bookingHoldId,
      mobile: input.mobile,
      ipAddress: input.ipAddress,
      outcome: input.outcome,
      provider: input.provider ?? "twilio_verify",
      providerVerificationSid: input.providerVerificationSid,
      metadata: input.metadata ?? null,
    });
  }

  private async recordBlockedOtpSendEvent(input: {
    organizationId: string;
    hold: {
      id: string;
      businessId: string;
      mobile: string;
    };
    clientIp?: string;
    outcome: string;
    provider?: string;
    providerVerificationSid?: string | null;
    metadata?: Record<string, unknown> | null;
  }) {
    await this.recordOtpSendEvent({
      organizationId: input.organizationId,
      businessId: input.hold.businessId,
      bookingHoldId: input.hold.id,
      mobile: input.hold.mobile,
      ipAddress: this.resolveClientIp(input.clientIp),
      outcome: input.outcome,
      provider: input.provider ?? "twilio_verify",
      providerVerificationSid: input.providerVerificationSid ?? null,
      metadata: input.metadata ?? null,
    });
  }

  private hasReusableOtpChallenge(hold: {
    otpSid?: string | null;
    otpProviderMessageId?: string | null;
    otpCodeHash?: string | null;
  }): boolean {
    return !!(hold.otpSid || hold.otpProviderMessageId || hold.otpCodeHash);
  }

  private buildOtpHoldUpdate(
    otpResult: SendOtpResult,
    hold: {
      id: string;
      otpSentCount?: number | null;
      otpSendWindowKey?: string | null;
    },
    now: Date,
    resendAvailableAt: Date,
  ): Record<string, unknown> {
    return {
      otpSid: otpResult.provider === "twilio" ? otpResult.providerMessageId ?? null : null,
      otpProvider: otpResult.provider,
      otpProviderMessageId: otpResult.providerMessageId ?? null,
      otpCodeHash: otpResult.provider === "semaphore" ? otpResult.codeHash ?? null : null,
      otpCodeExpiresAt:
        otpResult.provider === "semaphore" ? otpResult.codeExpiresAt ?? null : null,
      otpSentCount: (hold.otpSentCount ?? 0) + 1,
      otpLastSentAt: now,
      otpCooldownEndsAt: resendAvailableAt,
      otpSendWindowKey:
        hold.otpSendWindowKey ??
        `${hold.id}:${Math.floor(now.getTime() / OTP_RESEND_WINDOW_MS)}`,
      updatedAt: now,
    };
  }

  private toOtpAuditProvider(provider: "twilio" | "semaphore"): string {
    return provider === "semaphore" ? "semaphore_otp" : "twilio_verify";
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
