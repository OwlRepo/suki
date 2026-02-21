import { Injectable } from "@nestjs/common";
import type { IEmailProvider, EmailSendResult } from "./email.provider";

@Injectable()
export class ResendEmailProvider implements IEmailProvider {
  private readonly apiKey: string | null;
  private readonly fromEmail: string | null;

  constructor() {
    const key = process.env.RESEND_API_KEY?.trim() || null;
    const from = process.env.RESEND_FROM_EMAIL?.trim() || null;
    this.apiKey = key?.toLowerCase().includes("placeholder") ? null : key;
    this.fromEmail = from?.toLowerCase().includes("placeholder") ? null : from;
  }

  async send(input: {
    to: string;
    subject: string;
    body: string;
    clientRef: string;
  }): Promise<EmailSendResult> {
    if (!this.apiKey || !this.fromEmail) {
      return {
        ok: false,
        transient: false,
        errorCode: "provider_not_configured",
      };
    }

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: [input.to],
          subject: input.subject,
          text: input.body,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      const id = data.id as string | undefined;

      if (res.ok && id) {
        return { ok: true, providerMessageId: id };
      }

      const status = res.status;
      if (status === 429 || status >= 500) {
        return { ok: false, transient: true, errorCode: "provider_transient" };
      }
      return { ok: false, transient: false, errorCode: "provider_rejected" };
    } catch {
      return { ok: false, transient: true, errorCode: "provider_transient" };
    }
  }
}
