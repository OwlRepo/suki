import { describe, it, expect } from "vitest";
import { isBookingHoldsCompatibilityError } from "./intake-booking.service";

describe("isBookingHoldsCompatibilityError", () => {
  it("returns true for undefined_table and undefined_column PostgreSQL errors", () => {
    expect(isBookingHoldsCompatibilityError({ code: "42P01" })).toBe(true);
    expect(isBookingHoldsCompatibilityError({ code: "42703" })).toBe(true);
  });

  it("returns true for booking_holds missing-relation style messages", () => {
    expect(
      isBookingHoldsCompatibilityError({
        message: 'relation "booking_holds" does not exist',
      }),
    ).toBe(true);
  });

  it("returns false for unrelated database errors", () => {
    expect(
      isBookingHoldsCompatibilityError({
        code: "23505",
        message: "duplicate key value violates unique constraint",
      }),
    ).toBe(false);
  });
});
