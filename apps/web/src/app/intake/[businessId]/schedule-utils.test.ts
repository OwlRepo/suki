import { describe, expect, it } from "vitest";
import { filterDayKeysByMonth, formatDayLabel } from "./schedule-utils";

describe("schedule-utils", () => {
  it("filters day keys to selected month", () => {
    const dayKeys = ["2026-09-30", "2026-10-01", "2026-10-15", "2026-11-01"];
    expect(filterDayKeysByMonth(dayKeys, "2026-10")).toEqual(["2026-10-01", "2026-10-15"]);
  });

  it("formats day labels from yyyy-mm-dd without month drift", () => {
    expect(formatDayLabel("2026-10-01")).toMatch(/Oct\s+1/);
    expect(formatDayLabel("2026-10-31")).toMatch(/Oct\s+31/);
  });
});
