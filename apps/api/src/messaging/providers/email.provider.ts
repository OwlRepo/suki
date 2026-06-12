import { Injectable } from "@nestjs/common";

export interface EmailSendResult {
  ok: boolean;
  providerMessageId?: string;
  transient?: boolean;
  errorCode?: string;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  content: Uint8Array;
}

export interface IEmailProvider {
  send(input: {
    to: string;
    subject: string;
    body: string;
    clientRef: string;
    attachments?: EmailAttachment[];
  }): Promise<EmailSendResult>;
}

/**
 * No-op Email provider when no provider is configured.
 */
@Injectable()
export class NoopEmailProvider implements IEmailProvider {
  async send(_input: {
    to: string;
    subject: string;
    body: string;
    clientRef: string;
    attachments?: EmailAttachment[];
  }): Promise<EmailSendResult> {
    return {
      ok: false,
      transient: false,
      errorCode: "provider_not_configured",
    };
  }
}
