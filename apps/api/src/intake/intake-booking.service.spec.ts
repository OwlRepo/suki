import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AutomationSendService } from "../automation/automation-send.service";
import type { OrgBillingStateService } from "../common/org-billing-state.service";
import {
  IntakeBookingService,
  isBookingHoldsCompatibilityError,
} from "./intake-booking.service";

const limitMock = vi.fn();
const whereMock = vi.fn();
const fromMock = vi.fn();
const selectMock = vi.fn();
const updateWhereMock = vi.fn();
const setMock = vi.fn();
const updateMock = vi.fn();
const insertValuesMock = vi.fn();
const insertMock = vi.fn();
const transactionMock = vi.fn();

const automationSendMock = {
  sendAppointmentConfirmation: vi.fn(),
} as unknown as AutomationSendService;

const orgBillingStateMock = {
  getOrgBillingState: vi.fn(),
} as unknown as OrgBillingStateService;

vi.mock("@tyvera/database", () => ({
  getDb: () => ({
    select: selectMock,
    from: fromMock,
    where: whereMock,
    update: updateMock,
    insert: insertMock,
    transaction: transactionMock,
  }),
  bookingHolds: {
    id: "id",
  },
  businesses: {
    id: "id",
    organizationId: "organization_id",
  },
  verifiedOnlineBookingCredits: {
    organizationId: "organization_id",
  },
  publicOtpSendEvents: {},
  verifiedOnlineBookingUsageEvents: {},
}));

describe("isBookingHoldsCompatibilityError", () => {
  it("returns true for undefined_table and undefined_column PostgreSQL errors", () => {
    expect(isBookingHoldsCompatibilityError({ code: "42P01" })).toBe(true);
    expect(isBookingHoldsCompatibilityError({ code: "42703" })).toBe(true);
  });

  it("returns false for unrelated database errors", () => {
    expect(
      isBookingHoldsCompatibilityError({
        code: "23505",
        message: "duplicate",
      }),
    ).toBe(false);
  });
});

describe("IntakeBookingService OTP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limitMock.mockReset();
    whereMock.mockReset();
    fromMock.mockReset();
    selectMock.mockReset();
    updateWhereMock.mockReset();
    setMock.mockReset();
    updateMock.mockReset();
    insertValuesMock.mockReset();
    insertMock.mockReset();
    transactionMock.mockReset();

    selectMock.mockReturnValue({
      from: fromMock,
    });

    fromMock.mockReturnValue({
      where: whereMock,
    });

    whereMock.mockReturnValue({
      limit: limitMock,
    });

    updateMock.mockReturnValue({
      set: setMock,
    });

    insertMock.mockReturnValue({
      values: insertValuesMock,
    });

    setMock.mockReturnValue({
      where: updateWhereMock,
    });

    updateWhereMock.mockResolvedValue(undefined);
    insertValuesMock.mockResolvedValue(undefined);
    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        execute: vi.fn(),
        select: selectMock,
        insert: insertMock,
        update: updateMock,
      }),
    );
    vi.mocked(orgBillingStateMock.getOrgBillingState).mockResolvedValue({
      variableCostActionsBlocked: false,
    } as never);

    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_VERIFY_SERVICE_SID;
  });

  it("rejects when hold is not found", async () => {
    const service = new IntakeBookingService(
      automationSendMock,
      orgBillingStateMock,
    );

    limitMock.mockResolvedValueOnce([]);

    await expect(
      service.sendOtp("hold_1"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects when provider env is missing", async () => {
    const service = new IntakeBookingService(
      automationSendMock,
      orgBillingStateMock,
    );

    limitMock.mockResolvedValueOnce([
      {
        id: "h1",
        businessId: "biz-1",
        status: "held",
        expiresAt: new Date(Date.now() + 60_000),
        mobile: "+639171234567",
        otpSentCount: 0,
        updatedAt: new Date(Date.now() - 120_000),
      },
    ]);
    limitMock.mockResolvedValueOnce([{ organizationId: "org-1" }]);
    limitMock.mockResolvedValueOnce([
      {
        organizationId: "org-1",
        month: "2026-06",
        includedGranted: 5,
        addonGranted: 0,
        used: 0,
        sourcePlan: "free",
      },
    ]);

    await expect(
      service.sendOtp("hold_1"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("updates otp sid and consumes a verified booking credit on successful send", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_VERIFY_SERVICE_SID = "VA123";

    const service = new IntakeBookingService(
      automationSendMock,
      orgBillingStateMock,
    );

    limitMock.mockResolvedValueOnce([
      {
        id: "h1",
        businessId: "biz-1",
        status: "held",
        expiresAt: new Date(Date.now() + 60_000),
        mobile: "+639171234567",
        otpSentCount: 0,
        updatedAt: new Date(Date.now() - 120_000),
      },
    ]);
    limitMock.mockResolvedValueOnce([{ organizationId: "org-1" }]);
    limitMock.mockResolvedValueOnce([
      {
        organizationId: "org-1",
        month: "2026-06",
        includedGranted: 5,
        addonGranted: 0,
        used: 2,
        sourcePlan: "free",
      },
    ]);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          sid: "VE123",
        }),
      }) as unknown as typeof fetch,
    );

    await expect(
      service.sendOtp("hold_1"),
    ).resolves.toEqual(
      expect.objectContaining({
        success: true,
        reused: false,
        holdExpiresAt: expect.any(String),
        resendAvailableAt: expect.any(String),
        sendsRemaining: expect.any(Number),
      }),
    );

    expect(updateMock).toHaveBeenCalled();
    expect(insertMock).toHaveBeenCalled();
  });

  it("blocks public OTP sends with a safe message when verified booking credits are exhausted", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_VERIFY_SERVICE_SID = "VA123";

    const service = new IntakeBookingService(
      automationSendMock,
      orgBillingStateMock,
    );

    limitMock.mockResolvedValueOnce([
      {
        id: "h1",
        businessId: "biz-1",
        status: "held",
        expiresAt: new Date(Date.now() + 60_000),
        mobile: "+639171234567",
        otpSentCount: 0,
        updatedAt: new Date(Date.now() - 120_000),
      },
    ]);
    limitMock.mockResolvedValueOnce([{ organizationId: "org-1" }]);
    limitMock.mockResolvedValueOnce([
      {
        organizationId: "org-1",
        month: "2026-06",
        includedGranted: 5,
        addonGranted: 0,
        used: 5,
        sourcePlan: "free",
      },
    ]);

    await expect(service.sendOtp("hold_1")).rejects.toThrow(
      /temporarily unavailable/i,
    );
  });

  it("does not consume a second credit when OTP is re-requested inside the resend window", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_VERIFY_SERVICE_SID = "VA123";

    const service = new IntakeBookingService(
      automationSendMock,
      orgBillingStateMock,
    );

    limitMock.mockResolvedValueOnce([
      {
        id: "h1",
        businessId: "biz-1",
        status: "held",
        expiresAt: new Date(Date.now() + 60_000),
        mobile: "+639171234567",
        otpSid: "VE123",
        otpSentCount: 1,
        updatedAt: new Date(),
      },
    ]);
    limitMock.mockResolvedValueOnce([{ organizationId: "org-1" }]);

    await expect(service.sendOtp("hold_1")).resolves.toEqual({
      success: true,
      reused: true,
      holdExpiresAt: expect.any(String),
      resendAvailableAt: expect.any(String),
      sendsRemaining: expect.any(Number),
    });

    expect(insertMock).not.toHaveBeenCalled();
  });

  it("blocks resend while hold cooldown is active", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_VERIFY_SERVICE_SID = "VA123";
    process.env.OTP_RESEND_COOLDOWN_SECONDS = "60";

    const service = new IntakeBookingService(
      automationSendMock,
      orgBillingStateMock,
    );

    limitMock.mockResolvedValueOnce([
      {
        id: "h1",
        businessId: "biz-1",
        status: "held",
        expiresAt: new Date(Date.now() + 60_000),
        mobile: "+639171234567",
        otpSid: "VE123",
        otpSentCount: 1,
        otpCooldownEndsAt: new Date(Date.now() + 30_000),
        updatedAt: new Date(Date.now() - 120_000),
      },
    ]);
    limitMock.mockResolvedValueOnce([{ organizationId: "org-1" }]);

    await expect(service.sendOtp("hold_1")).rejects.toThrow(/temporarily unavailable/i);
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingHoldId: "h1",
        outcome: "OTP_RESEND_COOLDOWN",
      }),
    );
  });

  it("blocks OTP sends when the same mobile exceeds the rolling limit", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_VERIFY_SERVICE_SID = "VA123";
    process.env.OTP_PER_MOBILE_LIMIT = "2";
    process.env.OTP_PER_MOBILE_WINDOW_MINUTES = "60";

    const service = new IntakeBookingService(
      automationSendMock,
      orgBillingStateMock,
    );

    limitMock.mockResolvedValueOnce([
      {
        id: "h1",
        businessId: "biz-1",
        status: "held",
        expiresAt: new Date(Date.now() + 60_000),
        mobile: "+639171234567",
        otpSentCount: 0,
        updatedAt: new Date(Date.now() - 120_000),
      },
    ]);
    limitMock.mockResolvedValueOnce([{ organizationId: "org-1" }]);
    limitMock.mockResolvedValueOnce([
      {
        organizationId: "org-1",
        month: "2026-06",
        includedGranted: 5,
        addonGranted: 0,
        used: 0,
        sourcePlan: "free",
      },
    ]);
    limitMock.mockResolvedValueOnce([
      {
        id: "evt-1",
        mobile: "+639171234567",
        ipAddress: "127.0.0.1",
        businessId: "biz-1",
        outcome: "sent",
        createdAt: new Date(),
      },
      {
        id: "evt-2",
        mobile: "+639171234567",
        ipAddress: "127.0.0.2",
        businessId: "biz-2",
        outcome: "sent",
        createdAt: new Date(),
      },
    ]);

    await expect(service.sendOtp("hold_1", "127.0.0.1")).rejects.toThrow(/too many verification attempts/i);
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingHoldId: "h1",
        outcome: "OTP_MOBILE_RATE_LIMIT",
      }),
    );
  });

  it("blocks OTP sends when the same IP exceeds the rolling limit", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_VERIFY_SERVICE_SID = "VA123";
    process.env.OTP_PER_MOBILE_LIMIT = "5";
    process.env.OTP_PER_MOBILE_WINDOW_MINUTES = "60";
    process.env.OTP_PER_IP_LIMIT = "2";
    process.env.OTP_PER_IP_WINDOW_MINUTES = "60";

    const service = new IntakeBookingService(
      automationSendMock,
      orgBillingStateMock,
    );

    limitMock.mockResolvedValueOnce([
      {
        id: "h1",
        businessId: "biz-1",
        status: "held",
        expiresAt: new Date(Date.now() + 60_000),
        mobile: "+639171234567",
        otpSentCount: 0,
        updatedAt: new Date(Date.now() - 120_000),
      },
    ]);
    limitMock.mockResolvedValueOnce([{ organizationId: "org-1" }]);
    limitMock.mockResolvedValueOnce([]);
    limitMock.mockResolvedValueOnce([
      {
        organizationId: "org-1",
        month: "2026-06",
        includedGranted: 5,
        addonGranted: 0,
        used: 0,
        sourcePlan: "free",
      },
    ]);
    limitMock.mockResolvedValueOnce([
      {
        id: "evt-1",
        mobile: "+639171234568",
        ipAddress: "127.0.0.1",
        businessId: "biz-1",
        outcome: "sent",
        createdAt: new Date(),
      },
      {
        id: "evt-2",
        mobile: "+639171234569",
        ipAddress: "127.0.0.1",
        businessId: "biz-2",
        outcome: "sent",
        createdAt: new Date(),
      },
    ]);

    await expect(service.sendOtp("hold_1", "127.0.0.1")).rejects.toThrow(/too many verification attempts/i);
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingHoldId: "h1",
        outcome: "OTP_IP_RATE_LIMIT",
      }),
    );
  });

  it("blocks OTP sends when the business daily cap is exceeded", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_VERIFY_SERVICE_SID = "VA123";
    process.env.OTP_PER_MOBILE_LIMIT = "5";
    process.env.OTP_PER_MOBILE_WINDOW_MINUTES = "60";
    process.env.OTP_PER_IP_LIMIT = "10";
    process.env.OTP_PER_IP_WINDOW_MINUTES = "60";
    process.env.OTP_PER_BUSINESS_DAILY_LIMIT = "2";

    const service = new IntakeBookingService(
      automationSendMock,
      orgBillingStateMock,
    );

    limitMock.mockResolvedValueOnce([
      {
        id: "h1",
        businessId: "biz-1",
        status: "held",
        expiresAt: new Date(Date.now() + 60_000),
        mobile: "+639171234567",
        otpSentCount: 0,
        updatedAt: new Date(Date.now() - 120_000),
      },
    ]);
    limitMock.mockResolvedValueOnce([{ organizationId: "org-1" }]);
    limitMock.mockResolvedValueOnce([]);
    limitMock.mockResolvedValueOnce([]);
    limitMock.mockResolvedValueOnce([
      {
        organizationId: "org-1",
        month: "2026-06",
        includedGranted: 5,
        addonGranted: 0,
        used: 0,
        sourcePlan: "free",
      },
    ]);
    limitMock.mockResolvedValueOnce([
      {
        id: "evt-1",
        mobile: "+639171234568",
        ipAddress: "127.0.0.1",
        businessId: "biz-1",
        outcome: "sent",
        createdAt: new Date(),
      },
      {
        id: "evt-2",
        mobile: "+639171234569",
        ipAddress: "127.0.0.2",
        businessId: "biz-1",
        outcome: "sent",
        createdAt: new Date(),
      },
    ]);

    await expect(service.sendOtp("hold_1", "127.0.0.9")).rejects.toThrow(/too many verification attempts/i);
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingHoldId: "h1",
        outcome: "OTP_BUSINESS_DAILY_LIMIT",
      }),
    );
  });

  it("returns a stable code for invalid OTP verification attempts", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_VERIFY_SERVICE_SID = "VA123";
    const service = new IntakeBookingService(
      automationSendMock,
      orgBillingStateMock,
    );
    limitMock.mockResolvedValueOnce([
      {
        id: "h1",
        businessId: "biz-1",
        status: "held",
        expiresAt: new Date(Date.now() + 60_000),
        mobile: "+639171234567",
        otpAttempts: 0,
        scheduledAt: new Date(Date.now() + 120_000),
      },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ valid: false }),
      }) as unknown as typeof fetch,
    );

    await expect(service.verifyAndConfirm("hold_1", "123456")).rejects.toMatchObject({
      response: expect.objectContaining({ code: "OTP_INVALID_CODE" }),
    });
  });

  it("returns a stable code when max OTP attempts are reached", async () => {
    const service = new IntakeBookingService(
      automationSendMock,
      orgBillingStateMock,
    );
    limitMock.mockResolvedValueOnce([
      {
        id: "h1",
        businessId: "biz-1",
        status: "held",
        expiresAt: new Date(Date.now() + 60_000),
        mobile: "+639171234567",
        otpAttempts: 5,
        scheduledAt: new Date(Date.now() + 120_000),
      },
    ]);

    await expect(service.verifyAndConfirm("hold_1", "123456")).rejects.toMatchObject({
      response: expect.objectContaining({ code: "OTP_MAX_ATTEMPTS" }),
    });
  });

  it("returns a stable code when the OTP hold is expired", async () => {
    const service = new IntakeBookingService(
      automationSendMock,
      orgBillingStateMock,
    );
    limitMock.mockResolvedValueOnce([
      {
        id: "h1",
        businessId: "biz-1",
        status: "held",
        expiresAt: new Date(Date.now() - 60_000),
        mobile: "+639171234567",
        otpAttempts: 0,
        scheduledAt: new Date(Date.now() + 120_000),
      },
    ]);

    await expect(service.verifyAndConfirm("hold_1", "123456")).rejects.toMatchObject({
      response: expect.objectContaining({ code: "OTP_HOLD_EXPIRED" }),
    });
  });

  it("returns a stable code when a slot conflict happens after OTP verification", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_VERIFY_SERVICE_SID = "VA123";
    const service = new IntakeBookingService(
      automationSendMock,
      orgBillingStateMock,
    );
    limitMock.mockResolvedValueOnce([
      {
        id: "h1",
        businessId: "biz-1",
        customerId: "cust-1",
        status: "held",
        expiresAt: new Date(Date.now() + 60_000),
        mobile: "+639171234567",
        otpAttempts: 0,
        scheduledAt: new Date(Date.now() + 120_000),
      },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ valid: true }),
      }) as unknown as typeof fetch,
    );
    transactionMock.mockRejectedValueOnce(new Error("Selected slot is no longer available"));

    await expect(service.verifyAndConfirm("hold_1", "123456")).rejects.toMatchObject({
      response: expect.objectContaining({ code: "OTP_SLOT_CONFLICT" }),
    });
  });
});
