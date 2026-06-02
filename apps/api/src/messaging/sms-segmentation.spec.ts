import { describe, expect, it } from "vitest";
import { calculateSmsSegments } from "./sms-segmentation";

describe("calculateSmsSegments", () => {
  it("counts GSM-7 single and concatenated messages", () => {
    expect(calculateSmsSegments("a".repeat(160))).toEqual({
      encoding: "GSM-7",
      length: 160,
      segments: 1,
    });
    expect(calculateSmsSegments("a".repeat(161))).toEqual({
      encoding: "GSM-7",
      length: 161,
      segments: 2,
    });
    expect(calculateSmsSegments("a".repeat(306)).segments).toBe(2);
    expect(calculateSmsSegments("a".repeat(307)).segments).toBe(3);
  });

  it("counts GSM-7 extension characters as two septets", () => {
    expect(calculateSmsSegments("^".repeat(80))).toEqual({
      encoding: "GSM-7",
      length: 160,
      segments: 1,
    });
    expect(calculateSmsSegments("^".repeat(81))).toEqual({
      encoding: "GSM-7",
      length: 162,
      segments: 2,
    });
  });

  it("counts UCS-2 single and concatenated messages", () => {
    expect(calculateSmsSegments("漢".repeat(70))).toEqual({
      encoding: "UCS-2",
      length: 70,
      segments: 1,
    });
    expect(calculateSmsSegments("漢".repeat(71))).toEqual({
      encoding: "UCS-2",
      length: 71,
      segments: 2,
    });
    expect(calculateSmsSegments("漢".repeat(134)).segments).toBe(2);
    expect(calculateSmsSegments("漢".repeat(135)).segments).toBe(3);
  });

  it("counts emoji by UCS-2 code units", () => {
    expect(calculateSmsSegments("🙂".repeat(35))).toEqual({
      encoding: "UCS-2",
      length: 70,
      segments: 1,
    });
    expect(calculateSmsSegments("🙂".repeat(36))).toEqual({
      encoding: "UCS-2",
      length: 72,
      segments: 2,
    });
  });

  it("handles empty content deterministically", () => {
    expect(calculateSmsSegments("")).toEqual({
      encoding: "GSM-7",
      length: 0,
      segments: 0,
    });
  });
});
