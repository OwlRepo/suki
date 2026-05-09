import { describe, expect, it } from "vitest";
import { asMessage, normalizeApiError } from "./error-utils";

describe("intake page error helpers", () => {
  it("extracts first message from string array payload", () => {
    expect(asMessage(["", "Internal server error", "ignored"])).toBe("Internal server error");
  });

  it("normalizes API error to message when available", () => {
    expect(normalizeApiError({ message: ["Internal server error"] }, "fallback")).toBe(
      "Internal server error",
    );
  });

  it("falls back when payload has no usable message", () => {
    expect(normalizeApiError({ message: [] }, "friendly fallback")).toBe("friendly fallback");
  });
});
