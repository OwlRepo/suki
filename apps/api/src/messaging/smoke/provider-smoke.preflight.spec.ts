import { describe, expect, it } from "vitest";
import { getProviderSmokePreflight } from "./provider-smoke.preflight";

describe("provider smoke preflight", () => {
  it("fails when flag or required env is missing", () => {
    const out = getProviderSmokePreflight({ SMOKE_REAL_PROVIDERS: "false" });
    expect(out.ok).toBe(false);
    expect(out.missing.length).toBeGreaterThan(0);
    expect(out.messages.join(" ")).toContain("intentionally skipped");
  });

  it("passes when all required env are present", () => {
    const out = getProviderSmokePreflight({
      SMOKE_REAL_PROVIDERS: "true",
      TWILIO_ACCOUNT_SID: "AC123",
      TWILIO_AUTH_TOKEN: "token",
      TWILIO_MESSAGING_SERVICE_SID: "MG123",
      SMOKE_TWILIO_TO: "+639171234567",
      RESEND_API_KEY: "re_123",
      RESEND_FROM_EMAIL: "noreply@test.com",
      SMOKE_RESEND_TO: "deliverability@test.com",
    });
    expect(out.ok).toBe(true);
    expect(out.missing).toEqual([]);
  });
});
