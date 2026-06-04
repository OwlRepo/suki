import { afterEach, describe, expect, it, vi } from "vitest";
import { SemaphoreOtpProvider, verifyOtpHash } from "./semaphore-otp.provider";

describe("SemaphoreOtpProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SEMAPHORE_API_KEY;
    delete process.env.SEMAPHORE_SENDER_NAME;
  });

  it("returns provider_not_configured when API key is missing", async () => {
    const provider = new SemaphoreOtpProvider();

    await expect(provider.send({ mobile: "+639171234567" })).resolves.toEqual({
      ok: false,
      provider: "semaphore",
      transient: false,
      safeToRetry: false,
      errorCode: "provider_not_configured",
    });
  });

  it("generates a code, sends it to Semaphore, and returns only a hash for storage", async () => {
    process.env.SEMAPHORE_API_KEY = "sem-key";
    process.env.SEMAPHORE_SENDER_NAME = "TYVERA";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message_id: "otp-1", status: "Queued" }),
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const provider = new SemaphoreOtpProvider();
    const result = await provider.send({ mobile: "+639171234567" });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        provider: "semaphore",
        providerMessageId: "otp-1",
        codeHash: expect.any(String),
        codeExpiresAt: expect.any(Date),
      }),
    );
    expect(result).not.toHaveProperty("code");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = String(init.body);
    const sentCode = new URLSearchParams(body).get("code");
    expect(sentCode).toMatch(/^\d{6}$/);
    expect(result.codeHash).not.toContain(sentCode!);
    expect(await verifyOtpHash(sentCode!, result.codeHash!)).toBe(true);
  });

  it("verifies local hashes with expiration and timing-safe comparison", async () => {
    const provider = new SemaphoreOtpProvider();
    const hash = await provider.hashCodeForTest("123456");

    await expect(
      provider.verify({
        mobile: "+639171234567",
        code: "123456",
        storedCodeHash: hash,
        codeExpiresAt: new Date(Date.now() + 60_000),
      }),
    ).resolves.toEqual({ valid: true, provider: "semaphore" });
    await expect(
      provider.verify({
        mobile: "+639171234567",
        code: "000000",
        storedCodeHash: hash,
        codeExpiresAt: new Date(Date.now() + 60_000),
      }),
    ).resolves.toEqual({ valid: false, provider: "semaphore", errorCode: "OTP_INVALID_CODE" });
    await expect(
      provider.verify({
        mobile: "+639171234567",
        code: "123456",
        storedCodeHash: hash,
        codeExpiresAt: new Date(Date.now() - 1_000),
      }),
    ).resolves.toEqual({ valid: false, provider: "semaphore", errorCode: "OTP_HOLD_EXPIRED" });
  });

  it("maps provider failures safely", async () => {
    process.env.SEMAPHORE_API_KEY = "sem-key";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: "down" }) })
        .mockRejectedValueOnce(new Error("network")) as unknown as typeof fetch,
    );

    const provider = new SemaphoreOtpProvider();
    await expect(provider.send({ mobile: "+639171234567" })).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        provider: "semaphore",
        transient: true,
        safeToRetry: true,
        errorCode: "provider_transient_retryable",
      }),
    );
    await expect(provider.send({ mobile: "+639171234567" })).resolves.toEqual({
      ok: false,
      provider: "semaphore",
      transient: true,
      safeToRetry: false,
      errorCode: "provider_outcome_unknown",
    });
  });
});
