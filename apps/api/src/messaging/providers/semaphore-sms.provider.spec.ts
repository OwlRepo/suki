import { afterEach, describe, expect, it, vi } from "vitest";
import { SemaphoreSmsProvider } from "./semaphore-sms.provider";

describe("SemaphoreSmsProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SEMAPHORE_API_KEY;
    delete process.env.SEMAPHORE_SENDER_NAME;
  });

  it("returns provider_not_configured when API key is missing", async () => {
    const provider = new SemaphoreSmsProvider();

    await expect(
      provider.send({ to: "+639171234567", body: "hello", clientRef: "ref" }),
    ).resolves.toEqual({
      ok: false,
      provider: "semaphore",
      transient: false,
      safeToRetry: false,
      errorCode: "provider_not_configured",
    });
  });

  it("normalizes Philippine E.164 numbers and sends Semaphore payload", async () => {
    process.env.SEMAPHORE_API_KEY = "sem-key";
    process.env.SEMAPHORE_SENDER_NAME = "TYVERA";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ message_id: "sem-1", status: "Queued" }],
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const provider = new SemaphoreSmsProvider();
    await expect(
      provider.send({ to: "+639171234567", body: "hello", clientRef: "ref" }),
    ).resolves.toEqual({
      ok: true,
      provider: "semaphore",
      providerMessageId: "sem-1",
      providerMetadata: { message_id: "sem-1", status: "Queued" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.semaphore.co/api/v4/messages",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("number=639171234567"),
      }),
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(init.body)).toContain("apikey=sem-key");
    expect(String(init.body)).toContain("message=hello");
    expect(String(init.body)).toContain("sendername=TYVERA");
  });

  it("accepts numeric message IDs returned by Semaphore", async () => {
    process.env.SEMAPHORE_API_KEY = "sem-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [{ message_id: 12345, status: "Queued" }],
      }) as unknown as typeof fetch,
    );

    const provider = new SemaphoreSmsProvider();

    await expect(
      provider.send({ to: "639171234567", body: "hello", clientRef: "ref" }),
    ).resolves.toEqual({
      ok: true,
      provider: "semaphore",
      providerMessageId: "12345",
      providerMetadata: { message_id: 12345, status: "Queued" },
    });
  });

  it("maps retryable and rejected Semaphore responses", async () => {
    process.env.SEMAPHORE_API_KEY = "sem-key";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ status: "rate" }) })
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ status: "down" }) })
        .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: "bad" }) }) as unknown as typeof fetch,
    );

    const provider = new SemaphoreSmsProvider();
    await expect(provider.send({ to: "639171234567", body: "a", clientRef: "r" })).resolves.toEqual({
      ok: false,
      provider: "semaphore",
      transient: true,
      safeToRetry: true,
      errorCode: "provider_transient_retryable",
      providerMetadata: { status: "rate" },
    });
    await expect(provider.send({ to: "639171234567", body: "a", clientRef: "r" })).resolves.toEqual({
      ok: false,
      provider: "semaphore",
      transient: true,
      safeToRetry: true,
      errorCode: "provider_transient_retryable",
      providerMetadata: { status: "down" },
    });
    await expect(provider.send({ to: "639171234567", body: "a", clientRef: "r" })).resolves.toEqual({
      ok: false,
      provider: "semaphore",
      transient: false,
      safeToRetry: false,
      errorCode: "provider_rejected",
      providerMetadata: { error: "bad" },
    });
  });

  it("maps network exceptions to unknown outcome", async () => {
    process.env.SEMAPHORE_API_KEY = "sem-key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")) as unknown as typeof fetch);

    const provider = new SemaphoreSmsProvider();

    await expect(provider.send({ to: "639171234567", body: "a", clientRef: "r" })).resolves.toEqual({
      ok: false,
      provider: "semaphore",
      transient: true,
      safeToRetry: false,
      errorCode: "provider_outcome_unknown",
    });
  });
});
