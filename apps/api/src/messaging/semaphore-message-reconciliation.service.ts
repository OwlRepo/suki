import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { businesses, getDb, messageEvents } from "@tyvera/database";
import { and, eq, gte, inArray, isNotNull, ne } from "drizzle-orm";
import {
  MANUAL_FOLLOW_UP_AUTOMATION_KEYS,
  SEMAPHORE_RECONCILIATION_BATCH_SIZE,
  SEMAPHORE_RECONCILIATION_CRON,
  SEMAPHORE_RECONCILIATION_LOOKBACK_HOURS,
} from "./manual-follow-ups/manual-follow-up.constants";
import { ManualFollowUpService } from "./manual-follow-ups/manual-follow-up.service";

export function stripKnownAutomationFooter(body: string): string {
  const footer = " Sent automatically by Tyvera";
  return body.endsWith(footer) ? body.slice(0, -footer.length) : body;
}

@Injectable()
export class SemaphoreMessageReconciliationService {
  constructor(private readonly manualFollowUps: ManualFollowUpService) {}

  @Cron(SEMAPHORE_RECONCILIATION_CRON)
  async runScheduledReconciliation() {
    if (process.env.SEMAPHORE_RECONCILIATION_ENABLED !== "true") return;
    await this.reconcileRecentMessages();
  }

  async reconcileRecentMessages() {
    const apiKey = process.env.SEMAPHORE_API_KEY?.trim();
    if (!apiKey) return { checked: 0, failed: 0 };

    const db = getDb();
    const lookback = new Date(
      Date.now() - SEMAPHORE_RECONCILIATION_LOOKBACK_HOURS * 60 * 60 * 1000,
    );
    const events = await db
      .select({
        id: messageEvents.id,
        businessId: messageEvents.businessId,
        organizationId: businesses.organizationId,
        content: messageEvents.content,
        providerMessageId: messageEvents.providerMessageId,
      })
      .from(messageEvents)
      .innerJoin(businesses, eq(messageEvents.businessId, businesses.id))
      .where(
        and(
          eq(messageEvents.channel, "sms"),
          eq(messageEvents.provider, "semaphore"),
          isNotNull(messageEvents.providerMessageId),
          gte(messageEvents.createdAt, lookback),
          inArray(messageEvents.automationKey, [...MANUAL_FOLLOW_UP_AUTOMATION_KEYS]),
          ne(messageEvents.deliveryStatus, "failed"),
        ),
      )
      .limit(SEMAPHORE_RECONCILIATION_BATCH_SIZE);

    let failed = 0;
    for (const event of events) {
      const rawStatus = await this.fetchSemaphoreStatus(apiKey, event.providerMessageId!);
      const mapped = this.mapSemaphoreStatus(rawStatus);
      if (!mapped) continue;
      const updates: Record<string, unknown> = { deliveryStatus: mapped };
      if (mapped === "failed") {
        failed += 1;
        updates.status = "failed";
        updates.failureReason =
          rawStatus === "refunded" ? "semaphore_refunded" : "semaphore_failed";
      }
      await db.update(messageEvents).set(updates).where(eq(messageEvents.id, event.id));
      if (mapped === "failed") {
        await this.manualFollowUps.createFromMessageEvent({
          organizationId: event.organizationId,
          businessId: event.businessId,
          originalMessageEventId: event.id,
          manualRetryRawMessage: stripKnownAutomationFooter(event.content),
          fallbackFailureReason:
            rawStatus === "refunded" ? "semaphore_refunded" : "semaphore_failed",
        });
      }
    }

    return { checked: events.length, failed };
  }

  async fetchSemaphoreStatus(apiKey: string, messageId: string): Promise<string | null> {
    const res = await fetch(
      `https://api.semaphore.co/api/v4/messages/${encodeURIComponent(messageId)}?apikey=${encodeURIComponent(apiKey)}`,
    );
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as unknown;
    const record = Array.isArray(data) ? data[0] : data;
    if (!record || typeof record !== "object") return null;
    const status = (record as Record<string, unknown>).status;
    return typeof status === "string" ? status.toLowerCase() : null;
  }

  mapSemaphoreStatus(
    rawStatus: string | null,
  ): "queued" | "sent" | "failed" | null {
    switch (rawStatus?.toLowerCase()) {
      case "queued":
      case "pending":
        return "queued";
      case "sent":
        return "sent";
      case "failed":
      case "refunded":
        return "failed";
      default:
        return null;
    }
  }
}
