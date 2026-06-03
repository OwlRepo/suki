import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { BillingWebhookController } from "./billing-webhook.controller";

describe("BillingWebhookController", () => {
  it("rejects invalid webhook signatures", async () => {
    const controller = new BillingWebhookController(
      {
        verifyWebhookSignature: vi.fn().mockReturnValue(false),
      } as never,
      {
        reconcileWebhookEvent: vi.fn(),
      } as never,
    );

    await expect(
      controller.handleLemonSqueezyWebhook(
        {
          rawBody: Buffer.from("{}"),
          headers: {
            "x-signature": "bad",
          },
        } as never,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("processes a verified webhook using a delivery key derived from the raw body", async () => {
    const reconcileWebhookEvent = vi.fn().mockResolvedValue("processed");

    const controller = new BillingWebhookController(
      {
        verifyWebhookSignature: vi.fn().mockReturnValue(true),
        createWebhookDeliveryKey: vi
          .fn()
          .mockReturnValue("lemonsqueezy:payload-hash-1"),
      } as never,
      {
        reconcileWebhookEvent,
      } as never,
    );

    const payload = {
      meta: {
        event_name: "subscription_created",
        custom_data: {
          organization_id: "org-1",
        },
      },
      data: {
        id: "subscription-123",
      },
    };

    await expect(
      controller.handleLemonSqueezyWebhook(
        {
          rawBody: Buffer.from(JSON.stringify(payload)),
          headers: {
            "x-signature": "good",
          },
        } as never,
      ),
    ).resolves.toEqual({
      received: true,
      duplicate: false,
    });

    expect(reconcileWebhookEvent).toHaveBeenCalledWith(
      payload,
      "lemonsqueezy:payload-hash-1",
    );
  });

  it("returns duplicate true when the same signed payload has already been claimed", async () => {
    const controller = new BillingWebhookController(
      {
        verifyWebhookSignature: vi.fn().mockReturnValue(true),
        createWebhookDeliveryKey: vi
          .fn()
          .mockReturnValue("lemonsqueezy:payload-hash-1"),
      } as never,
      {
        reconcileWebhookEvent: vi.fn().mockResolvedValue("duplicate"),
      } as never,
    );

    await expect(
      controller.handleLemonSqueezyWebhook(
        {
          rawBody: Buffer.from(
            JSON.stringify({
              meta: {
                event_name: "subscription_updated",
              },
              data: {
                id: "subscription-123",
              },
            }),
          ),
          headers: {
            "x-signature": "good",
          },
        } as never,
      ),
    ).resolves.toEqual({
      received: true,
      duplicate: true,
    });
  });

  it("returns 200 for unknown but valid webhook events", async () => {
    const controller = new BillingWebhookController(
      {
        verifyWebhookSignature: vi.fn().mockReturnValue(true),
        createWebhookDeliveryKey: vi
          .fn()
          .mockReturnValue("lemonsqueezy:payload-hash-unknown"),
      } as never,
      {
        reconcileWebhookEvent: vi.fn().mockResolvedValue("ignored"),
      } as never,
    );

    await expect(
      controller.handleLemonSqueezyWebhook(
        {
          rawBody: Buffer.from(
            JSON.stringify({
              meta: {
                event_name: "license_key_created",
              },
              data: {
                id: "license-123",
              },
            }),
          ),
          headers: {
            "x-signature": "good",
          },
        } as never,
      ),
    ).resolves.toEqual({
      received: true,
      duplicate: false,
    });
  });
});