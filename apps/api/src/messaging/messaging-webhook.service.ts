import { Injectable, UnauthorizedException } from "@nestjs/common";
import { Webhook } from "svix";
import { getDb } from "@tyvera/database";
import { messageEvents, processedWebhookEvents } from "@tyvera/database";
import { eq, sql } from "drizzle-orm";
import { createHash } from "crypto";

const TERMINAL_STATUSES = ["delivered", "failed", "bounced", "rejected"] as const;

@Injectable()
export class MessagingWebhookService {
  async handleTwilioStatus(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const messageSid = payload.MessageSid as string | undefined;
    const status = String(payload.MessageStatus ?? "").toLowerCase();
    if (!messageSid) return;
    await this.updateMessageByProviderId(messageSid, "twilio", status, payload);
  }

  async handleResendEvent(
    payloadStr: string,
    headers: { "svix-id"?: string; "svix-timestamp"?: string; "svix-signature"?: string },
  ): Promise<void> {
    const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
    if (!secret) {
      throw new UnauthorizedException("Resend webhook not configured");
    }
    const wh = new Webhook(secret);
    let parsed: Record<string, unknown>;
    try {
      parsed = wh.verify(payloadStr, headers) as Record<string, unknown>;
    } catch {
      throw new UnauthorizedException("Invalid signature");
    }
    const type = parsed.type as string | undefined;
    const eventId = `resend:${headers["svix-id"]}`;
    const db = getDb();
    const [claimed] = await db
      .insert(processedWebhookEvents)
      .values({
        eventId,
        provider: "resend",
        eventName: type ?? null,
        payloadHash: createHash("sha256").update(payloadStr).digest("hex"),
        status: "processed",
        processedAt: new Date(),
      })
      .onConflictDoNothing({ target: processedWebhookEvents.eventId })
      .returning();

    if (!claimed) return;

    const data = parsed.data as Record<string, unknown> | undefined;
    const id = data?.id as string | undefined;
    if (!id) return;

    try {
      await this.updateMessageByProviderId(id, "resend", type ?? "", parsed);
    } catch (error) {
      await db
        .update(processedWebhookEvents)
        .set({
          status: "failed",
          failureReason:
            error instanceof Error ? error.message : "Resend webhook failed",
          retryCount: sql`${processedWebhookEvents.retryCount} + 1`,
          processedAt: new Date(),
        })
        .where(eq(processedWebhookEvents.eventId, eventId));
      throw error;
    }
  }

  private async updateMessageByProviderId(
    providerMessageId: string,
    provider: "twilio" | "resend",
    statusOrType: string,
    rawPayload: Record<string, unknown>,
  ): Promise<void> {
    const db = getDb();
    const [evt] = await db
      .select({ id: messageEvents.id, deliveryStatus: messageEvents.deliveryStatus })
      .from(messageEvents)
      .where(eq(messageEvents.providerMessageId, providerMessageId))
      .limit(1);
    if (!evt) return;
    if (TERMINAL_STATUSES.includes(evt.deliveryStatus as (typeof TERMINAL_STATUSES)[number])) {
      return;
    }
    const mapped = this.mapToDeliveryStatus(provider, statusOrType);
    if (!mapped) return;
    const updates: Record<string, unknown> = {
      deliveryStatus: mapped,
      providerMetadata: rawPayload,
    };
    if (mapped === "failed" || mapped === "bounced" || mapped === "rejected") {
      const err = (rawPayload as Record<string, unknown>).ErrorMessage ??
        (rawPayload as Record<string, unknown>).error_code ??
        (rawPayload as Record<string, unknown>).ErrorCode ??
        "unknown";
      updates.failureReason = String(err);
    }
    await db
      .update(messageEvents)
      .set(updates as Record<string, string | null | Record<string, unknown>>)
      .where(eq(messageEvents.id, evt.id));
  }

  private mapToDeliveryStatus(
    provider: "twilio" | "resend",
    statusOrType: string,
  ): "queued" | "sent" | "delivered" | "failed" | "bounced" | "rejected" | null {
    const s = statusOrType.toLowerCase();
    if (provider === "twilio") {
      if (s === "accepted" || s === "scheduled" || s === "queued") return "queued";
      if (s === "sending" || s === "sent") return "sent";
      if (s === "delivered") return "delivered";
      if (s === "undelivered" || s === "failed") return "failed";
      if (s === "canceled" || s === "cancelled") return "rejected";
      return null;
    }
    if (provider === "resend") {
      if (s === "email.sent") return "sent";
      if (s === "email.delivered") return "delivered";
      if (s === "email.delivery_delayed") return "queued";
      if (s === "email.bounced") return "bounced";
      if (s === "email.complained") return "rejected";
      if (s === "email.suppressed") return "rejected";
      if (s === "email.failed") return "failed";
      return null;
    }
    return null;
  }
}
