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
        isWebhookEventProcessed: vi.fn(),
        recordWebhookEventId: vi.fn(),
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

  it("records verified webhook events idempotently", async () => {
    const reconcileWebhookEvent = vi.fn().mockResolvedValue(undefined);
    const controller = new BillingWebhookController(
      {
        verifyWebhookSignature: vi.fn().mockReturnValue(true),
      } as never,
      {
        isWebhookEventProcessed: vi.fn().mockResolvedValue(false),
        reconcileWebhookEvent,
      } as never,
    );

    await expect(
      controller.handleLemonSqueezyWebhook(
        {
          rawBody: Buffer.from(
            JSON.stringify({
              meta: {
                event_name: "subscription_created",
                custom_data: {
                  organization_id: "org-1",
                },
              },
              data: {
                id: "evt_123",
              },
            }),
          ),
          headers: {
            "x-signature": "good",
          },
        } as never,
      ),
    ).resolves.toEqual({ received: true, duplicate: false });

    expect(reconcileWebhookEvent).toHaveBeenCalledWith({
      meta: {
        event_name: "subscription_created",
        custom_data: {
          organization_id: "org-1",
        },
      },
      data: {
        id: "evt_123",
      },
    });
  });

  it("returns 200 for unknown but valid webhook events and lets the service persist them", async () => {
    const reconcileWebhookEvent = vi.fn().mockResolvedValue(undefined);
    const controller = new BillingWebhookController(
      {
        verifyWebhookSignature: vi.fn().mockReturnValue(true),
      } as never,
      {
        isWebhookEventProcessed: vi.fn().mockResolvedValue(false),
        reconcileWebhookEvent,
      } as never,
    );

    await expect(
      controller.handleLemonSqueezyWebhook(
        {
          rawBody: Buffer.from(
            JSON.stringify({
              meta: { event_name: "license_key_created" },
              data: { id: "evt_unknown_1" },
            }),
          ),
          headers: {
            "x-signature": "good",
          },
        } as never,
      ),
    ).resolves.toEqual({ received: true, duplicate: false });

    expect(reconcileWebhookEvent).toHaveBeenCalledWith({
      meta: { event_name: "license_key_created" },
      data: { id: "evt_unknown_1" },
    });
  });
});
