import { describe, expect, it } from "vitest";
import { createSmsLink, normalizeSmsRecipient } from "./create-sms-link";

describe("createSmsLink", () => {
  it("includes normalized recipient and encoded body", () => {
    expect(normalizeSmsRecipient("+63 917-123-4567")).toBe("+639171234567");
    expect(createSmsLink("+63 917-123-4567", "Hi Ana & Ben")).toBe(
      "sms:+639171234567?body=Hi%20Ana%20%26%20Ben",
    );
  });
});
