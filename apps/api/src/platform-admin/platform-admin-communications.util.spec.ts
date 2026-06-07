import { describe, expect, it } from "vitest";
import { maskRecipient } from "./platform-admin-communications.util";

describe("platform-admin communications utilities", () => {
  it("masks Philippine mobile numbers", () => {
    expect(maskRecipient("+639171234567")).toBe("*******4567");
  });

  it("masks email addresses without hiding the domain", () => {
    expect(maskRecipient("romeo@example.com")).toBe("r***@example.com");
  });

  it("returns null for blank recipients", () => {
    expect(maskRecipient("   ")).toBeNull();
    expect(maskRecipient(null)).toBeNull();
  });
});
