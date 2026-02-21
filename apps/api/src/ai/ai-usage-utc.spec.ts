import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

function getCurrentMonthUTC(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function getMonthBoundariesUTC(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return { start, end };
}

function getDayStartUTC(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
  );
}

describe("AI Usage UTC boundary helpers", () => {
  describe("getMonthBoundariesUTC", () => {
    it("returns correct boundaries for February 2024 (leap year)", () => {
      const { start, end } = getMonthBoundariesUTC("2024-02");
      expect(start.toISOString()).toBe("2024-02-01T00:00:00.000Z");
      expect(end.toISOString()).toBe("2024-02-29T23:59:59.999Z");
    });

    it("returns correct boundaries for February 2023 (non-leap)", () => {
      const { start, end } = getMonthBoundariesUTC("2023-02");
      expect(start.toISOString()).toBe("2023-02-01T00:00:00.000Z");
      expect(end.toISOString()).toBe("2023-02-28T23:59:59.999Z");
    });

    it("returns correct boundaries for December", () => {
      const { start, end } = getMonthBoundariesUTC("2024-12");
      expect(start.toISOString()).toBe("2024-12-01T00:00:00.000Z");
      expect(end.toISOString()).toBe("2024-12-31T23:59:59.999Z");
    });

    it("returns correct boundaries for January", () => {
      const { start, end } = getMonthBoundariesUTC("2024-01");
      expect(start.toISOString()).toBe("2024-01-01T00:00:00.000Z");
      expect(end.toISOString()).toBe("2024-01-31T23:59:59.999Z");
    });

    it("end is last millisecond before next month starts", () => {
      const { start, end } = getMonthBoundariesUTC("2024-06");
      const nextMonthStart = new Date(Date.UTC(2024, 6, 1, 0, 0, 0, 0));
      expect(end.getTime()).toBe(nextMonthStart.getTime() - 1);
    });
  });

  describe("getDayStartUTC", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns UTC midnight for a given UTC day", () => {
      vi.setSystemTime(new Date("2024-07-15T14:30:00.000Z"));
      const dayStart = getDayStartUTC();
      expect(dayStart.toISOString()).toBe("2024-07-15T00:00:00.000Z");
    });

    it("handles year boundary", () => {
      vi.setSystemTime(new Date("2023-12-31T23:59:59.999Z"));
      const dayStart = getDayStartUTC();
      expect(dayStart.toISOString()).toBe("2023-12-31T00:00:00.000Z");
    });

    it("handles month boundary", () => {
      vi.setSystemTime(new Date("2024-02-01T00:00:00.001Z"));
      const dayStart = getDayStartUTC();
      expect(dayStart.toISOString()).toBe("2024-02-01T00:00:00.000Z");
    });
  });

  describe("getCurrentMonthUTC", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns YYYY-MM in UTC", () => {
      vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));
      expect(getCurrentMonthUTC()).toBe("2024-06");
    });

    it("handles UTC month boundary - late evening local still previous month UTC", () => {
      vi.setSystemTime(new Date("2024-06-30T23:59:59.999Z"));
      expect(getCurrentMonthUTC()).toBe("2024-06");
    });

    it("handles UTC month rollover", () => {
      vi.setSystemTime(new Date("2024-07-01T00:00:00.000Z"));
      expect(getCurrentMonthUTC()).toBe("2024-07");
    });
  });
});
