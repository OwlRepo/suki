import { describe, expect, it } from "vitest";
import {
  isAppointmentsVerificationCompatibilityError,
  isBookingSecurityCompatibilityError,
} from "./appointments.service";

describe("appointments compatibility guards", () => {
  it("detects missing verification columns", () => {
    expect(isAppointmentsVerificationCompatibilityError({ code: "42703" })).toBe(true);
    expect(isAppointmentsVerificationCompatibilityError({ message: 'column "verification_mode" does not exist' })).toBe(true);
    expect(isAppointmentsVerificationCompatibilityError({ message: 'column "verified_at" does not exist' })).toBe(true);
    expect(isAppointmentsVerificationCompatibilityError({ code: "23505", message: "duplicate key" })).toBe(false);
  });

  it("detects missing booking security schema objects", () => {
    expect(isBookingSecurityCompatibilityError({ code: "42P01" })).toBe(true);
    expect(isBookingSecurityCompatibilityError({ code: "42704" })).toBe(true);
    expect(isBookingSecurityCompatibilityError({ message: 'type "appointment_verification_mode" does not exist' })).toBe(true);
    expect(isBookingSecurityCompatibilityError({ message: 'relation "booking_pin_attempt_logs" does not exist' })).toBe(true);
    expect(isBookingSecurityCompatibilityError({ code: "22001", message: "value too long" })).toBe(false);
  });
});
