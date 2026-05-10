import { describe, expect, it } from "vitest";
import {
  defaultVerifyMode,
  canSubmitVerify,
  normalizeBookingError,
  shouldShowManagerPinSetupOnAppointments,
} from "./booking-flow";

describe("appointments booking flow helpers", () => {
  it("defaults to OTP when mobile exists", () => {
    expect(defaultVerifyMode({ mobile: "09123456789" })).toBe("otp");
  });

  it("defaults to manager override when mobile missing", () => {
    expect(defaultVerifyMode({ mobile: "" })).toBe("override");
    expect(defaultVerifyMode({ mobile: undefined })).toBe("override");
  });

  it("requires per-mode fields", () => {
    expect(canSubmitVerify({ mode: "otp", otpCode: "" })).toBe(false);
    expect(canSubmitVerify({ mode: "otp", otpCode: "123456" })).toBe(true);
    expect(canSubmitVerify({ mode: "override", pin: "1234", reason: "" })).toBe(false);
    expect(canSubmitVerify({ mode: "override", pin: "1234", reason: "No phone" })).toBe(true);
  });

  it("normalizes common booking errors", () => {
    expect(normalizeBookingError(new Error("Conflict Exception"))).toContain("just taken");
    expect(normalizeBookingError(new Error("Manager PIN is not configured."))).toContain("Settings");
    expect(normalizeBookingError(new Error("Invalid manager PIN."))).toContain("Invalid manager PIN");
    expect(normalizeBookingError(new Error("Too many failed PIN attempts. Please try again later."))).toContain("Too many failed PIN attempts");
  });

  it("hides editable manager pin setup on appointments", () => {
    expect(shouldShowManagerPinSetupOnAppointments()).toBe(false);
  });
});
