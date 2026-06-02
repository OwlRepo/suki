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
    const recordWebhookEventId = vi.fn().mockResolvedValue(undefined);
    const controller = new BillingWebhookController(
      {
        verifyWebhookSignature: vi.fn().mockReturnValue(true),
      } as never,
      {
        isWebhookEventProcessed: vi.fn().mockResolvedValue(false),
        recordWebhookEventId,
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

    expect(recordWebhookEventId).toHaveBeenCalledWith(
      "evt_123",
      "subscription_created",
    );
  });
});
