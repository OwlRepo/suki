// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AvailabilityCalendar } from "./availability-calendar";

describe("AvailabilityCalendar", () => {
  it("shows available and unavailable days and only allows available selection", () => {
    const onSelect = vi.fn();
    render(
      <AvailabilityCalendar
        month="2026-05"
        selectedDay="2026-05-10"
        availableDays={["2026-05-10", "2026-05-11"]}
        onSelect={onSelect}
      />,
    );

    const availableDay = screen.getByRole("button", { name: /5\/10\/2026 available/i });
    const unavailableDay = screen.getByRole("button", { name: /5\/12\/2026 unavailable/i });

    expect(availableDay).toBeEnabled();
    expect(unavailableDay).toBeDisabled();

    fireEvent.click(availableDay);
    expect(onSelect).toHaveBeenCalledWith("2026-05-10");
  });
});
