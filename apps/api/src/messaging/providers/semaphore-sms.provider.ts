import { Injectable } from "@nestjs/common";
import type { ISmsProvider, SmsSendResult } from "./sms.provider";

const SEMAPHORE_MESSAGES_URL = "https://api.semaphore.co/api/v4/messages";

@Injectable()
export class SemaphoreSmsProvider implements ISmsProvider {
  readonly providerName = "semaphore";
  private readonly apiKey: string | null;
  private readonly senderName: string | null;

  constructor() {
    const apiKey = process.env.SEMAPHORE_API_KEY?.trim() || null;
    const senderName = process.env.SEMAPHORE_SENDER_NAME?.trim() || null;
    this.apiKey =
      apiKey && !apiKey.toLowerCase().includes("placeholder") ? apiKey : null;
    this.senderName =
      senderName && !senderName.toLowerCase().includes("placeholder")
        ? senderName
        : null;
  }

  async send(input: {
    to: string;
    body: string;
    clientRef: string;
  }): Promise<SmsSendResult> {
    if (!this.apiKey) {
      return {
        ok: false,
        provider: "semaphore",
        transient: false,
        safeToRetry: false,
        errorCode: "provider_not_configured",
      };
    }

    const params = new URLSearchParams();
    params.set("apikey", this.apiKey);
    params.set("number", this.normalizeNumber(input.to));
    params.set("message", input.body);
    if (this.senderName) {
      params.set("sendername", this.senderName);
    }

    try {
      const res = await fetch(SEMAPHORE_MESSAGES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      const data = (await res.json().catch(() => ({}))) as unknown;
      const metadata = this.extractMetadata(data);

      if (res.ok) {
        const messageId = this.extractMessageId(data);
        if (messageId) {
          return {
            ok: true,
            provider: "semaphore",
            providerMessageId: messageId,
            providerMetadata: metadata,
          };
        }
      }

      if (res.status === 429 || res.status >= 500) {
        return {
          ok: false,
          provider: "semaphore",
          transient: true,
          safeToRetry: true,
          errorCode: "provider_transient_retryable",
          providerMetadata: metadata,
        };
      }

      return {
        ok: false,
        provider: "semaphore",
        transient: false,
        safeToRetry: false,
        errorCode: "provider_rejected",
        providerMetadata: metadata,
      };
    } catch {
      return {
        ok: false,
        provider: "semaphore",
        transient: true,
        safeToRetry: false,
        errorCode: "provider_outcome_unknown",
      };
    }
  }

  private normalizeNumber(number: string): string {
    const trimmed = number.trim();
    return trimmed.startsWith("+") ? trimmed.slice(1) : trimmed;
  }

  private extractMessageId(data: unknown): string | undefined {
    const record = Array.isArray(data) ? data[0] : data;
    if (!record || typeof record !== "object") return undefined;
    const messageId = (record as Record<string, unknown>).message_id;
    if (typeof messageId === "string" && messageId) return messageId;
    if (typeof messageId === "number" && Number.isFinite(messageId)) {
      return String(messageId);
    }
    return undefined;
  }

  private extractMetadata(data: unknown): Record<string, unknown> | undefined {
    const record = Array.isArray(data) ? data[0] : data;
    if (!record || typeof record !== "object") return undefined;
    return record as Record<string, unknown>;
  }
}
