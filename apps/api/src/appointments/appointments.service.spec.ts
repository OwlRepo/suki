import { describe, expect, it } from "vitest";
import {
  hashOtpSkipPin,
  isBookingSecurityCompatibilityError,
  isValidOtpSkipPin,
} from "./appointments.service";

describe("appointments security helpers", () => {
  it("validates 4-8 digit PIN", () => {
    expect(isValidOtpSkipPin("1234")).toBe(true);
    expect(isValidOtpSkipPin("12345678")).toBe(true);
    expect(isValidOtpSkipPin("123")).toBe(false);
    expect(isValidOtpSkipPin("123456789")).toBe(false);
    expect(isValidOtpSkipPin("12ab")).toBe(false);
  });

  it("hashes deterministically", () => {
    expect(hashOtpSkipPin("1234")).toBe(hashOtpSkipPin("1234"));
    expect(hashOtpSkipPin("1234")).not.toBe(hashOtpSkipPin("5678"));
  });

  it("detects booking security compatibility errors", () => {
    expect(isBookingSecurityCompatibilityError({ code: "42P01" })).toBe(true);
    expect(isBookingSecurityCompatibilityError({ message: 'relation "booking_security_settings" does not exist' })).toBe(true);
    expect(isBookingSecurityCompatibilityError({ code: "23505", message: "duplicate key" })).toBe(false);
  });
});
