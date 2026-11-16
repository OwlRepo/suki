import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AvailabilityCalendar } from "./availability-calendar";

describe("booking calendar date identity", () => {
  it("regression: renders the offered local calendar day without UTC date shifts", () => {
    render(<AvailabilityCalendar month="2026-11" selectedDay="2026-11-17" availableDays={["2026-11-17"]} onSelect={vi.fn()} />);
    const offeredDay = screen.getByRole("button", { name: "11/17/2026 available" });
    expect(offeredDay).toHaveTextContent("17");
    expect(offeredDay).toHaveAttribute("aria-pressed", "true");
  });
});
