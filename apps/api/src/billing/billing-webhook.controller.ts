import {
  Controller,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { BillingService } from "./billing.service";
import { LemonsqueezyService } from "./lemonsqueezy.service";

type RawBodyRequest = Request & {
  rawBody?: Buffer | string;
};

type LemonWebhookPayload = {
  meta?: {
    event_name?: string;
    custom_data?: Record<string, unknown>;
  };
  data?: {
    id?: string;
    attributes?: Record<string, unknown>;
  };
};

@Controller("billing")
export class BillingWebhookController {
  constructor(
    private readonly lemonsqueezy: LemonsqueezyService,
    private readonly billingService: BillingService,
  ) {}

  @Post("webhook/lemonsqueezy")
  async handleLemonSqueezyWebhook(@Req() req: RawBodyRequest) {
    const signature = req.headers["x-signature"];
    const signatureValue = Array.isArray(signature) ? signature[0] : signature;
    const rawBody = req.rawBody ?? "";

    if (!this.lemonsqueezy.verifyWebhookSignature(rawBody, signatureValue)) {
      throw new UnauthorizedException("Invalid webhook signature");
    }

    const payload = JSON.parse(
      Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody),
    ) as LemonWebhookPayload;

    const deliveryKey =
      this.lemonsqueezy.createWebhookDeliveryKey(rawBody);

    const result = await this.billingService.reconcileWebhookEvent(
      payload,
      deliveryKey,
    );

    return {
      received: true,
      duplicate: result === "duplicate",
    };
  }
}