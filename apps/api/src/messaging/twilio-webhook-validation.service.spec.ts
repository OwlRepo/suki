import { UnauthorizedException } from "@nestjs/common";
import { afterEach, describe, expect, it } from "vitest";
import { createHmac } from "crypto";
import { TwilioWebhookValidationService } from "./twilio-webhook-validation.service";

function sign(url: string, params: Record<string, unknown>, token = "auth-token") {
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((key) => key + String(params[key]))
      .join("");
  return createHmac("sha1", token).update(data).digest("base64");
}

function req(url: string, forwardedHost = "evil.example") {
  return {
    protocol: "http",
    originalUrl: "/messaging/inbound/sms",
    get: (name: string) => {
      if (name.toLowerCase() === "host") return "internal:3001";
      if (name.toLowerCase() === "x-forwarded-host") return forwardedHost;
      if (name.toLowerCase() === "x-forwarded-proto") return "https";
      return undefined;
    },
    url,
  };
}

describe("TwilioWebhookValidationService", () => {
  afterEach(() => {
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_INBOUND_SMS_WEBHOOK_URL;
    delete process.env.NODE_ENV;
  });

  it("rejects missing token or signature", () => {
    const service = new TwilioWebhookValidationService();
    expect(() =>
      service.validate({
        params: {},
        signature: undefined,
        configuredUrlEnv: "TWILIO_INBOUND_SMS_WEBHOOK_URL",
        request: req("/sms"),
      }),
    ).toThrow(UnauthorizedException);

    process.env.TWILIO_AUTH_TOKEN = "auth-token";
    expect(() =>
      service.validate({
        params: {},
        signature: undefined,
        configuredUrlEnv: "TWILIO_INBOUND_SMS_WEBHOOK_URL",
        request: req("/sms"),
      }),
    ).toThrow(UnauthorizedException);
  });

  it("accepts a valid signature for the configured public URL", () => {
    process.env.TWILIO_AUTH_TOKEN = "auth-token";
    process.env.TWILIO_INBOUND_SMS_WEBHOOK_URL = "https://tyvera.app/api/messaging/inbound/sms";
    const params = { From: "+639171234567", Body: "STOP", Unexpected: "ok" };
    const signature = sign(process.env.TWILIO_INBOUND_SMS_WEBHOOK_URL, params);

    const service = new TwilioWebhookValidationService();

    expect(() =>
      service.validate({
        params,
        signature,
        configuredUrlEnv: "TWILIO_INBOUND_SMS_WEBHOOK_URL",
        request: req("/messaging/inbound/sms"),
      }),
    ).not.toThrow();
  });

  it("rejects signatures for the wrong host or missing external api prefix", () => {
    process.env.TWILIO_AUTH_TOKEN = "auth-token";
    process.env.TWILIO_INBOUND_SMS_WEBHOOK_URL = "https://tyvera.app/api/messaging/inbound/sms";
    const params = { From: "+639171234567", Body: "STOP" };
    const wrongHost = sign("https://attacker.example/api/messaging/inbound/sms", params);
    const missingApi = sign("https://tyvera.app/messaging/inbound/sms", params);
    const service = new TwilioWebhookValidationService();

    for (const signature of [wrongHost, missingApi]) {
      expect(() =>
        service.validate({
          params,
          signature,
          configuredUrlEnv: "TWILIO_INBOUND_SMS_WEBHOOK_URL",
          request: req("/messaging/inbound/sms"),
        }),
      ).toThrow(UnauthorizedException);
    }
  });

  it("ignores spoofed forwarded headers when an explicit public URL is configured", () => {
    process.env.TWILIO_AUTH_TOKEN = "auth-token";
    process.env.TWILIO_INBOUND_SMS_WEBHOOK_URL = "https://tyvera.app/api/messaging/inbound/sms";
    const params = { From: "+639171234567", Body: "STOP" };
    const spoofed = sign("https://evil.example/messaging/inbound/sms", params);
    const service = new TwilioWebhookValidationService();

    expect(() =>
      service.validate({
        params,
        signature: spoofed,
        configuredUrlEnv: "TWILIO_INBOUND_SMS_WEBHOOK_URL",
        request: req("/messaging/inbound/sms", "tyvera.app"),
      }),
    ).toThrow(UnauthorizedException);
  });

  it("uses a deterministic local fallback outside production", () => {
    process.env.TWILIO_AUTH_TOKEN = "auth-token";
    process.env.NODE_ENV = "development";
    const params = { From: "+639171234567", Body: "STOP" };
    const fallbackUrl = "http://internal:3001/messaging/inbound/sms";
    const signature = sign(fallbackUrl, params);
    const service = new TwilioWebhookValidationService();

    expect(() =>
      service.validate({
        params,
        signature,
        configuredUrlEnv: "TWILIO_INBOUND_SMS_WEBHOOK_URL",
        request: req("/messaging/inbound/sms"),
      }),
    ).not.toThrow();
  });
});
