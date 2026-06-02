import { describe, expect, it } from "vitest";
import {
  PH_MOBILE_E164_ERROR,
  PH_MOBILE_E164_PLACEHOLDER,
  isValidPhilippineMobileE164,
  normalizePhilippineMobileE164,
} from "./index";

describe("Philippine mobile E.164 helpers", () => {
  it("accepts the required +63 mobile format", () => {
    expect(PH_MOBILE_E164_PLACEHOLDER).toBe("+639171234567");
    expect(isValidPhilippineMobileE164("+639171234567")).toBe(true);
    expect(normalizePhilippineMobileE164(" +639171234567 ")).toBe("+639171234567");
  });

  it.each([
    "",
    "09171234567",
    "9171234567",
    "+19171234567",
    "+638171234567",
    "+63917 123 4567",
    "+63917-123-4567",
    "+63917123456",
    "+6391712345678",
  ])("rejects %s", (value) => {
    expect(isValidPhilippineMobileE164(value)).toBe(false);
    expect(normalizePhilippineMobileE164(value)).toBeNull();
  });

  it("exposes exact user-facing guidance", () => {
    expect(PH_MOBILE_E164_ERROR).toBe("Use +63 format, for example +639171234567.");
  });
});
