import { Injectable } from "@nestjs/common";

export interface SmsSendResult {
  ok: boolean;
  provider?: "twilio" | "semaphore" | "unknown";
  providerMessageId?: string;
  transient?: boolean;
  safeToRetry?: boolean;
  errorCode?: string;
  providerMetadata?: Record<string, unknown>;
}

export interface ISmsProvider {
  send(input: {
    to: string;
    body: string;
    clientRef: string;
  }): Promise<SmsSendResult>;
}

/**
 * No-op SMS provider when no provider is configured.
 * Returns skipped/not_configured without throwing.
 */
@Injectable()
export class NoopSmsProvider implements ISmsProvider {
  async send(_input: {
    to: string;
    body: string;
    clientRef: string;
  }): Promise<SmsSendResult> {
    return {
      ok: false,
      provider: "unknown",
      transient: false,
      safeToRetry: false,
      errorCode: "provider_not_configured",
    };
  }
}
