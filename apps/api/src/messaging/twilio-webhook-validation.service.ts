import { Injectable, UnauthorizedException } from "@nestjs/common";
import twilio from "twilio";

export interface TwilioWebhookRequestLike {
  protocol: string;
  originalUrl: string;
  get(name: string): string | undefined;
}

export interface TwilioWebhookValidationInput {
  params: Record<string, unknown>;
  signature: string | undefined;
  configuredUrlEnv: "TWILIO_INBOUND_SMS_WEBHOOK_URL" | "TWILIO_STATUS_CALLBACK_URL";
  request: TwilioWebhookRequestLike;
}

function isUsableEnv(value: string | undefined): value is string {
  return !!value?.trim() && !value.toLowerCase().includes("placeholder");
}

@Injectable()
export class TwilioWebhookValidationService {
  validate(input: TwilioWebhookValidationInput): void {
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    if (!isUsableEnv(authToken) || !input.signature?.trim()) {
      throw new UnauthorizedException("Twilio webhook not configured");
    }

    const url = this.resolveValidationUrl(input.configuredUrlEnv, input.request);
    const valid = twilio.validateRequest(
      authToken,
      input.signature,
      url,
      input.params as Record<string, string>,
    );
    if (!valid) {
      throw new UnauthorizedException("Invalid signature");
    }
  }

  private resolveValidationUrl(
    envName: TwilioWebhookValidationInput["configuredUrlEnv"],
    request: TwilioWebhookRequestLike,
  ): string {
    const configured = process.env[envName]?.trim();
    if (isUsableEnv(configured)) return configured;
    if (process.env.NODE_ENV === "production") {
      throw new UnauthorizedException(`${envName} is required`);
    }
    const host = request.get("host") ?? "";
    return `${request.protocol}://${host}${request.originalUrl}`;
  }
}
