import { afterEach, describe, expect, it, vi } from "vitest";
import { OtpFailoverService } from "./otp-failover.service";

describe("OtpFailoverService", () => {
  afterEach(() => {
    delete process.env.OTP_PROVIDER_MODE;
  });

  function makeService(options?: {
    persistedProvider?: "twilio" | "semaphore" | null;
    twilioResult?: Record<string, unknown>;
    semaphoreResult?: Record<string, unknown>;
  }) {
    const twilio = {
      send: vi.fn(async () => options?.twilioResult ?? { ok: true, provider: "twilio", providerMessageId: "VE1" }),
      verify: vi.fn(),
    };
    const semaphore = {
      send: vi.fn(async () => options?.semaphoreResult ?? { ok: true, provider: "semaphore", providerMessageId: "SEM1" }),
      verify: vi.fn(),
    };
    const settings = {
      getProvider: vi.fn(async () => options?.persistedProvider ?? null),
      switchToSemaphore: vi.fn(async () => undefined),
    };

    return {
      service: new OtpFailoverService(twilio as never, semaphore as never, settings as never),
      twilio,
      semaphore,
      settings,
    };
  }

  it("honors forced provider modes", async () => {
    process.env.OTP_PROVIDER_MODE = "semaphore";
    let ctx = makeService();
    await expect(ctx.service.sendOtp({ organizationId: "org-1", mobile: "+639171234567" })).resolves.toEqual(
      expect.objectContaining({ provider: "semaphore" }),
    );
    expect(ctx.twilio.send).not.toHaveBeenCalled();

    process.env.OTP_PROVIDER_MODE = "twilio";
    ctx = makeService();
    await expect(ctx.service.sendOtp({ organizationId: "org-1", mobile: "+639171234567" })).resolves.toEqual(
      expect.objectContaining({ provider: "twilio" }),
    );
    expect(ctx.semaphore.send).not.toHaveBeenCalled();
  });

  it("uses persisted Semaphore state in auto mode without calling Twilio", async () => {
    process.env.OTP_PROVIDER_MODE = "auto";
    const ctx = makeService({ persistedProvider: "semaphore" });

    await expect(ctx.service.sendOtp({ organizationId: "org-1", mobile: "+639171234567" })).resolves.toEqual(
      expect.objectContaining({ provider: "semaphore" }),
    );

    expect(ctx.twilio.send).not.toHaveBeenCalled();
  });

  it("does not persist failover for non-eligible Twilio failures", async () => {
    process.env.OTP_PROVIDER_MODE = "auto";
    const ctx = makeService({
      twilioResult: {
        ok: false,
        provider: "twilio",
        transient: true,
        safeToRetry: true,
        errorCode: "provider_transient_retryable",
      },
    });

    await expect(ctx.service.sendOtp({ organizationId: "org-1", mobile: "+639171234567" })).resolves.toEqual(
      expect.objectContaining({ provider: "twilio", ok: false }),
    );

    expect(ctx.settings.switchToSemaphore).not.toHaveBeenCalled();
    expect(ctx.semaphore.send).not.toHaveBeenCalled();
  });

  it("persists failover and retries with Semaphore for eligible Twilio failures", async () => {
    process.env.OTP_PROVIDER_MODE = "auto";
    const ctx = makeService({
      twilioResult: {
        ok: false,
        provider: "twilio",
        transient: false,
        safeToRetry: false,
        errorCode: "60033",
        failoverEligible: true,
      },
    });

    await expect(ctx.service.sendOtp({ organizationId: "org-1", mobile: "+639171234567" })).resolves.toEqual(
      expect.objectContaining({ provider: "semaphore", ok: true }),
    );

    expect(ctx.settings.switchToSemaphore).toHaveBeenCalledWith({
      organizationId: "org-1",
      reason: "60033",
    });
    expect(ctx.semaphore.send).toHaveBeenCalledTimes(1);
  });
});
