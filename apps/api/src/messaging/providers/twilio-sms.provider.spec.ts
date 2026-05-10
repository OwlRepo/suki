import { afterEach, describe, expect, it, vi } from "vitest";
import { TwilioSmsProvider } from "./twilio-sms.provider";

describe("TwilioSmsProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_MESSAGING_SERVICE_SID;
    delete process.env.TWILIO_PHONE_NUMBER;
    delete process.env.TWILIO_STATUS_CALLBACK_URL;
  });

  it("returns provider_not_configured when credentials are missing", async () => {
    const provider = new TwilioSmsProvider();
    const out = await provider.send({ to: "+639171234567", body: "hi", clientRef: "ref" });
    expect(out).toEqual({ ok: false, transient: false, errorCode: "provider_not_configured" });
  });

  it("sends with messaging service sid", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_MESSAGING_SERVICE_SID = "MG123";
    process.env.TWILIO_STATUS_CALLBACK_URL = "https://example.com/cb";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sid: "SM123" }),
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const provider = new TwilioSmsProvider();
    const out = await provider.send({ to: "+639171234567", body: "hello", clientRef: "ref" });

    expect(out).toEqual({ ok: true, providerMessageId: "SM123" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(init?.body)).toContain("MessagingServiceSid=MG123");
    expect(String(init?.body)).toContain("StatusCallback=");
  });

  it("sends with phone number when service sid is absent", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_PHONE_NUMBER = "+15551234567";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sid: "SM555" }),
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const provider = new TwilioSmsProvider();
    await provider.send({ to: "+639171234567", body: "hello", clientRef: "ref" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(init?.body)).toContain("From=%2B15551234567");
  });

  it("returns transient for 5xx/429 and rejected for other non-ok responses", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_PHONE_NUMBER = "+15551234567";

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}) }) as unknown as typeof fetch,
    );

    const provider = new TwilioSmsProvider();
    await expect(provider.send({ to: "a", body: "b", clientRef: "c" })).resolves.toEqual({
      ok: false,
      transient: true,
      errorCode: "provider_transient",
    });
    await expect(provider.send({ to: "a", body: "b", clientRef: "c" })).resolves.toEqual({
      ok: false,
      transient: true,
      errorCode: "provider_transient",
    });
    await expect(provider.send({ to: "a", body: "b", clientRef: "c" })).resolves.toEqual({
      ok: false,
      transient: false,
      errorCode: "provider_rejected",
    });
  });

  it("returns transient on fetch error", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_PHONE_NUMBER = "+15551234567";

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")) as unknown as typeof fetch);
    const provider = new TwilioSmsProvider();
    await expect(provider.send({ to: "a", body: "b", clientRef: "c" })).resolves.toEqual({
      ok: false,
      transient: true,
      errorCode: "provider_transient",
    });
  });
});
