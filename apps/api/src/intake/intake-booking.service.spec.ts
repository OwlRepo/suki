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
    ).resolves.toEqual({
      success: true,
    });

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
        updatedAt: new Date(),
      },
    ]);

    await expect(service.sendOtp("hold_1")).resolves.toEqual({
      success: true,
      reused: true,
    });

    expect(insertMock).not.toHaveBeenCalled();
  });
});
