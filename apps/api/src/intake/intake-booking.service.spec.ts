import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntakeBookingService, isBookingHoldsCompatibilityError } from "./intake-booking.service";

const limitMock = vi.fn();
const whereMock = vi.fn();
const fromMock = vi.fn();
const selectMock = vi.fn();
const updateWhereMock = vi.fn();
const setMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@suki/database", () => ({
  getDb: () => ({
    select: selectMock,
    from: fromMock,
    where: whereMock,
    update: updateMock,
  }),
  bookingHolds: { id: "id" },
}));

describe("isBookingHoldsCompatibilityError", () => {
  it("returns true for undefined_table and undefined_column PostgreSQL errors", () => {
    expect(isBookingHoldsCompatibilityError({ code: "42P01" })).toBe(true);
    expect(isBookingHoldsCompatibilityError({ code: "42703" })).toBe(true);
  });

  it("returns false for unrelated database errors", () => {
    expect(isBookingHoldsCompatibilityError({ code: "23505", message: "duplicate" })).toBe(false);
  });
});

describe("IntakeBookingService OTP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectMock.mockReturnValue({ from: fromMock });
    fromMock.mockReturnValue({ where: whereMock });
    whereMock.mockReturnValue({ limit: limitMock });
    updateMock.mockReturnValue({ set: setMock });
    setMock.mockReturnValue({ where: updateWhereMock });
    updateWhereMock.mockResolvedValue(undefined);

    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_VERIFY_SERVICE_SID;
  });

  it("rejects when hold is not found", async () => {
    const service = new IntakeBookingService();
    limitMock.mockResolvedValueOnce([]);
    await expect(service.sendOtp("hold_1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects when provider env is missing", async () => {
    const service = new IntakeBookingService();
    limitMock.mockResolvedValueOnce([
      { id: "h1", status: "held", expiresAt: new Date(Date.now() + 60_000), mobile: "+639171234567" },
    ]);
    await expect(service.sendOtp("hold_1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("updates otp sid on successful send", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_VERIFY_SERVICE_SID = "VA123";

    const service = new IntakeBookingService();
    limitMock.mockResolvedValueOnce([
      { id: "h1", status: "held", expiresAt: new Date(Date.now() + 60_000), mobile: "+639171234567" },
    ]);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sid: "VE123" }) }) as unknown as typeof fetch,
    );

    await expect(service.sendOtp("hold_1")).resolves.toEqual({ success: true });
    expect(updateMock).toHaveBeenCalled();
  });
});
