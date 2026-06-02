import {
  Controller,
  Post,
  Req,
  Headers,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { MessagingWebhookService } from "./messaging-webhook.service";
import { TwilioWebhookValidationService } from "./twilio-webhook-validation.service";

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

@Controller("messaging/webhooks")
export class MessagingWebhooksController {
  constructor(
    private readonly webhookService: MessagingWebhookService,
    private readonly twilioValidation: TwilioWebhookValidationService,
  ) {}

  @Post("twilio/status")
  async handleTwilioStatus(
    @Req() req: RawBodyRequest,
    @Headers("x-twilio-signature") signature: string | undefined,
  ) {
    if (!signature) throw new UnauthorizedException("Missing signature");
    const body = req.body as Record<string, unknown>;
    if (!body || typeof body !== "object") {
      throw new BadRequestException("Invalid body");
    }
    this.twilioValidation.validate({
      params: body,
      signature,
      configuredUrlEnv: "TWILIO_STATUS_CALLBACK_URL",
      request: req,
    });
    await this.webhookService.handleTwilioStatus(body);
    return { received: true };
  }

  @Post("resend")
  async handleResend(
    @Req() req: RawBodyRequest,
    @Headers("svix-id") svixId: string | undefined,
    @Headers("svix-timestamp") svixTimestamp: string | undefined,
    @Headers("svix-signature") svixSignature: string | undefined,
  ) {
    if (!svixId || !svixTimestamp || !svixSignature) {
      throw new UnauthorizedException("Missing Svix headers");
    }
    const rawBody = req.rawBody ?? req.body;
    const payloadStr =
      typeof rawBody === "string"
        ? rawBody
        : Buffer.isBuffer(rawBody)
          ? rawBody.toString("utf8")
          : typeof rawBody === "object"
            ? JSON.stringify(rawBody)
            : String(rawBody ?? "");
    const headers: { "svix-id"?: string; "svix-timestamp"?: string; "svix-signature"?: string } = {};
    if (svixId) headers["svix-id"] = svixId;
    if (svixTimestamp) headers["svix-timestamp"] = svixTimestamp;
    if (svixSignature) headers["svix-signature"] = svixSignature;
    await this.webhookService.handleResendEvent(payloadStr, headers);
    return { received: true };
  }
}
