import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "crypto";
import { LemonsqueezyService } from "./lemonsqueezy.service";

describe("LemonsqueezyService", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    process.env.LEMONSQUEEZY_API_KEY = "test_api_key";
    process.env.LEMONSQUEEZY_STORE_ID = "123";
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET = "whsec_123";
    process.env.LEMONSQUEEZY_VARIANT_STARTER_MONTHLY = "111";
  });

  afterEach(() => {
    process.env = { ...envBackup };
    vi.unstubAllGlobals();
  });

  it("verifies webhook signatures using the raw payload", () => {
    const service = new LemonsqueezyService();
    const payload = JSON.stringify({ meta: { event_name: "subscription_created" } });
    const signature = createHmac("sha256", "whsec_123").update(payload).digest("hex");

    expect(service.verifyWebhookSignature(payload, signature)).toBe(true);
    expect(service.verifyWebhookSignature(payload, "nope")).toBe(false);
  });

  it("creates hosted checkout URLs with trusted custom data", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          attributes: {
            url: "https://checkout.example/abc",
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const service = new LemonsqueezyService();
    const result = await service.createCheckout({
      variantId: "111",
      organizationId: "org-1",
      userId: "user-1",
      purchaseKind: "subscription",
      planType: "starter",
      billingInterval: "monthly",
      productLabel: "Starter Monthly",
      successUrl: "https://tyvera.app/settings/billing?checkout=success",
      cancelUrl: "https://tyvera.app/settings/billing?checkout=cancelled",
    });

    expect(result).toEqual({
      checkoutUrl: "https://checkout.example/abc",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body));
    expect(body.data.attributes.checkout_data.custom).toMatchObject({
      organization_id: "org-1",
      user_id: "user-1",
      purchase_kind: "subscription",
      plan_type: "starter",
      billing_interval: "monthly",
    });
  });
});
