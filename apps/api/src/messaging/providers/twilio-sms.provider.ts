import { Injectable } from "@nestjs/common";
import type { ISmsProvider, SmsSendResult } from "./sms.provider";

@Injectable()
export class TwilioSmsProvider implements ISmsProvider {
  private readonly accountSid: string | null;
  private readonly authToken: string | null;
  private readonly sender: string | null; // MessagingServiceSid or From (phone number)
  private readonly useMessagingService: boolean;
  private readonly statusCallbackUrl: string | null;

  constructor() {
    const sid = process.env.TWILIO_ACCOUNT_SID?.trim() || null;
    const token = process.env.TWILIO_AUTH_TOKEN?.trim() || null;
    const serviceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() || null;
    const phone = process.env.TWILIO_PHONE_NUMBER?.trim() || null;
    this.accountSid = sid?.toLowerCase().includes("placeholder") ? null : sid;
    this.authToken = token?.toLowerCase().includes("placeholder") ? null : token;
    this.useMessagingService = !!serviceSid && !serviceSid.toLowerCase().includes("placeholder");
    this.sender = this.useMessagingService
      ? serviceSid
      : phone && !phone.toLowerCase().includes("placeholder")
        ? phone
        : null;
    const cb = process.env.TWILIO_STATUS_CALLBACK_URL?.trim() || null;
    this.statusCallbackUrl =
      cb && !cb.toLowerCase().includes("placeholder") ? cb : null;
  }

  async send(input: {
    to: string;
    body: string;
    clientRef: string;
  }): Promise<SmsSendResult> {
    if (!this.accountSid || !this.authToken || !this.sender) {
      return {
        ok: false,
        transient: false,
        errorCode: "provider_not_configured",
      };
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const basicAuth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");
    const params = new URLSearchParams();
    params.set("To", input.to);
    params.set("Body", input.body);
    if (this.useMessagingService) {
      params.set("MessagingServiceSid", this.sender!);
    } else {
      params.set("From", this.sender!);
    }
    if (this.statusCallbackUrl) {
      params.set("StatusCallback", this.statusCallbackUrl);
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const messageSid = data.sid as string | undefined;
      const providerMetadata = this.extractProviderMetadata(data);

      if (res.ok && messageSid) {
        return {
          ok: true,
          providerMessageId: messageSid,
          providerMetadata,
        };
      }

      const status = res.status;
      if (status === 429 || status >= 500) {
        return {
          ok: false,
          transient: true,
          safeToRetry: true,
          errorCode: "provider_transient_retryable",
          providerMetadata,
        };
      }
      return {
        ok: false,
        transient: false,
        safeToRetry: false,
        errorCode: "provider_rejected",
        providerMetadata,
      };
    } catch {
      return {
        ok: false,
        transient: true,
        safeToRetry: false,
        errorCode: "provider_outcome_unknown",
      };
    }
  }

  private extractProviderMetadata(data: Record<string, unknown>): Record<string, unknown> | undefined {
    const metadata: Record<string, unknown> = {};
    for (const key of ["status", "num_segments", "error_code", "error_message"]) {
      if (data[key] !== undefined && data[key] !== null) {
        metadata[key] = data[key];
      }
    }
    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }
}
