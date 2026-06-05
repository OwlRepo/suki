import { describe, expect, it } from "vitest";
import {
  appointmentDurationMinutesForBusinessType,
  appointmentLifecycleDueAt,
} from "./appointment-timing";

describe("appointment timing helpers", () => {
  it("uses 60 minutes for clinic appointments", () => {
    expect(appointmentDurationMinutesForBusinessType("clinic")).toBe(60);
  });

  it("uses 30 minutes for other business types", () => {
    expect(appointmentDurationMinutesForBusinessType("salon")).toBe(30);
    expect(appointmentDurationMinutesForBusinessType(null)).toBe(30);
  });

  it("calculates lifecycle deadline from duration plus 15-minute grace", () => {
    const scheduledAt = new Date("2026-06-05T02:00:00.000Z");

    expect(appointmentLifecycleDueAt(scheduledAt, 45)).toEqual(
      new Date("2026-06-05T03:00:00.000Z"),
    );
  });
});
