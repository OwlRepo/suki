import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { MessagingWebhooksController } from "./messaging-webhooks.controller";

function makeController(validate = vi.fn()) {
  const webhookService = {
    handleTwilioStatus: vi.fn(async () => undefined),
    handleResendEvent: vi.fn(async () => undefined),
  };
  const validator = { validate };
  return {
    controller: new MessagingWebhooksController(webhookService as never, validator as never),
    webhookService,
    validator,
  };
}

describe("MessagingWebhooksController", () => {
  it("rejects missing or invalid Twilio status signatures", async () => {
    const validate = vi.fn(() => {
      throw new UnauthorizedException("Invalid signature");
    });
    const { controller, webhookService } = makeController(validate);

    await expect(
      controller.handleTwilioStatus(
        { body: { MessageSid: "SM1", MessageStatus: "delivered" } } as never,
        undefined,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(webhookService.handleTwilioStatus).not.toHaveBeenCalled();
  });

  it("validates with the status callback URL env and accepts extra fields", async () => {
    const validate = vi.fn();
    const { controller, webhookService } = makeController(validate);
    const req = {
      body: {
        MessageSid: "SM1",
        MessageStatus: "accepted",
        ExtraField: "future",
      },
      protocol: "http",
      originalUrl: "/messaging/webhooks/twilio/status",
      get: () => "internal:3001",
    };

    await expect(
      controller.handleTwilioStatus(req as never, "valid-signature"),
    ).resolves.toEqual({ received: true });

    expect(validate).toHaveBeenCalledWith(
      expect.objectContaining({
        params: req.body,
        signature: "valid-signature",
        configuredUrlEnv: "TWILIO_STATUS_CALLBACK_URL",
        request: req,
      }),
    );
    expect(webhookService.handleTwilioStatus).toHaveBeenCalledWith(req.body);
  });

  it("rejects invalid Twilio status payloads", async () => {
    const { controller } = makeController(vi.fn());

    await expect(
      controller.handleTwilioStatus({ body: null } as never, "valid-signature"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
