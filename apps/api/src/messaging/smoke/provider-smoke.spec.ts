import { describe, expect, it } from "vitest";
import { TwilioSmsProvider } from "../providers/twilio-sms.provider";
import { ResendEmailProvider } from "../providers/resend-email.provider";
import { getProviderSmokePreflight } from "./provider-smoke.preflight";

const preflight = getProviderSmokePreflight(process.env);
const runSmoke = preflight.ok ? describe : describe.skip;

runSmoke("real provider smoke (Twilio/Resend)", () => {
  it("sends an SMS with Twilio", async () => {
    const provider = new TwilioSmsProvider();
    const result = await provider.send({
      to: process.env.SMOKE_TWILIO_TO as string,
      body: "Suki smoke test SMS",
      clientRef: `smoke-${Date.now()}`,
    });

    expect(result.ok).toBe(true);
    expect(result.providerMessageId).toBeTruthy();
  }, 20_000);

  it("sends an email with Resend", async () => {
    const provider = new ResendEmailProvider();
    const result = await provider.send({
      to: process.env.SMOKE_RESEND_TO as string,
      subject: "Suki smoke test email",
      body: "Suki smoke test email body",
      clientRef: `smoke-${Date.now()}`,
    });

    expect(result.ok).toBe(true);
    expect(result.providerMessageId).toBeTruthy();
  }, 20_000);
});

if (!preflight.ok) {
  // Keep one explicit skipped test message for visibility in reporter output.
  describe("real provider smoke preflight", () => {
    it.skip(`skipped: ${preflight.messages.join(" | ")}`, () => {
      expect(true).toBe(true);
    });
  });
}
