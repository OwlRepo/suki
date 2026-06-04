import { afterEach, describe, expect, it, vi } from "vitest";
import { TwilioVerifyOtpProvider } from "./twilio-verify-otp.provider";

describe("TwilioVerifyOtpProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_VERIFY_SERVICE_SID;
    delete process.env.TWILIO_OTP_FAILOVER_ON_ERROR_CODES;
  });

  it("returns provider_not_configured when Twilio Verify env is missing", async () => {
    const provider = new TwilioVerifyOtpProvider();

    await expect(provider.send({ mobile: "+639171234567" })).resolves.toEqual({
      ok: false,
      provider: "twilio",
      transient: false,
      safeToRetry: false,
      errorCode: "provider_not_configured",
    });
  });

  it("sends and verifies through Twilio Verify", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_VERIFY_SERVICE_SID = "VA123";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sid: "VE123", status: "pending" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ valid: true, status: "approved" }) });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const provider = new TwilioVerifyOtpProvider();
    await expect(provider.send({ mobile: "+639171234567" })).resolves.toEqual({
      ok: true,
      provider: "twilio",
      providerMessageId: "VE123",
      providerMetadata: { sid: "VE123", status: "pending" },
    });
    await expect(provider.verify({ mobile: "+639171234567", code: "123456" })).resolves.toEqual({
      valid: true,
      provider: "twilio",
    });
  });

  it("marks allowlisted Twilio errors as permanent failover candidates", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_VERIFY_SERVICE_SID = "VA123";
    process.env.TWILIO_OTP_FAILOVER_ON_ERROR_CODES = "60033";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ code: 60033, message: "balance" }),
      }) as unknown as typeof fetch,
    );

    const provider = new TwilioVerifyOtpProvider();

    await expect(provider.send({ mobile: "+639171234567" })).resolves.toEqual({
      ok: false,
      provider: "twilio",
      transient: false,
      safeToRetry: false,
      errorCode: "60033",
      failoverEligible: true,
      providerMetadata: { code: 60033, message: "balance" },
    });
  });

  it("does not mark transient failures as failover eligible", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_VERIFY_SERVICE_SID = "VA123";
    process.env.TWILIO_OTP_FAILOVER_ON_ERROR_CODES = "60033";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ code: 60033 }) })
        .mockRejectedValueOnce(new Error("network")) as unknown as typeof fetch,
    );

    const provider = new TwilioVerifyOtpProvider();
    await expect(provider.send({ mobile: "+639171234567" })).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        provider: "twilio",
        transient: true,
        safeToRetry: true,
        errorCode: "provider_transient_retryable",
      }),
    );
    await expect(provider.send({ mobile: "+639171234567" })).resolves.toEqual({
      ok: false,
      provider: "twilio",
      transient: true,
      safeToRetry: false,
      errorCode: "provider_outcome_unknown",
    });
  });
});
