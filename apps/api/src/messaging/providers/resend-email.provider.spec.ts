import { afterEach, describe, expect, it, vi } from "vitest";
import { ResendEmailProvider } from "./resend-email.provider";

describe("ResendEmailProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
  });

  it("returns provider_not_configured when credentials are missing", async () => {
    const provider = new ResendEmailProvider();
    await expect(
      provider.send({ to: "a@test.com", subject: "s", body: "b", clientRef: "ref" }),
    ).resolves.toEqual({ ok: false, transient: false, errorCode: "provider_not_configured" });
  });

  it("returns success with provider id", async () => {
    process.env.RESEND_API_KEY = "re_123";
    process.env.RESEND_FROM_EMAIL = "noreply@test.com";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "em_123" }) }) as unknown as typeof fetch,
    );

    const provider = new ResendEmailProvider();
    await expect(
      provider.send({ to: "a@test.com", subject: "s", body: "b", clientRef: "ref" }),
    ).resolves.toEqual({ ok: true, providerMessageId: "em_123" });
  });

  it("maps response errors to transient/rejected", async () => {
    process.env.RESEND_API_KEY = "re_123";
    process.env.RESEND_FROM_EMAIL = "noreply@test.com";

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}) }) as unknown as typeof fetch,
    );

    const provider = new ResendEmailProvider();
    await expect(provider.send({ to: "a@test.com", subject: "s", body: "b", clientRef: "ref" })).resolves.toEqual({ ok: false, transient: true, errorCode: "provider_transient" });
    await expect(provider.send({ to: "a@test.com", subject: "s", body: "b", clientRef: "ref" })).resolves.toEqual({ ok: false, transient: true, errorCode: "provider_transient" });
    await expect(provider.send({ to: "a@test.com", subject: "s", body: "b", clientRef: "ref" })).resolves.toEqual({ ok: false, transient: false, errorCode: "provider_rejected" });
  });

  it("returns transient on thrown fetch", async () => {
    process.env.RESEND_API_KEY = "re_123";
    process.env.RESEND_FROM_EMAIL = "noreply@test.com";

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")) as unknown as typeof fetch);
    const provider = new ResendEmailProvider();
    await expect(provider.send({ to: "a@test.com", subject: "s", body: "b", clientRef: "ref" })).resolves.toEqual({ ok: false, transient: true, errorCode: "provider_transient" });
  });
});
