import { Injectable } from "@nestjs/common";
import { getDb } from "@suki/database";
import { messageEvents } from "@suki/database";

export interface RecordMessageEventInput {
  businessId: string;
  customerId: string;
  appointmentId?: string;
  automationKey: string;
  purpose: "transactional" | "promotional";
  channel: "sms" | "email";
  content: string;
  status: "queued" | "sent" | "failed" | "skipped";
  providerMessageId?: string;
  failureReason?: string;
}

@Injectable()
export class AutomationTriggerService {
  async recordMessageEvent(input: RecordMessageEventInput) {
    const db = getDb();
    const [created] = await db
      .insert(messageEvents)
      .values({
        businessId: input.businessId,
        customerId: input.customerId,
        appointmentId: input.appointmentId ?? null,
        automationKey: input.automationKey,
        purpose: input.purpose,
        channel: input.channel,
        content: input.content,
        status: input.status,
        providerMessageId: input.providerMessageId ?? null,
        failureReason: input.failureReason ?? null,
        sentBy: "auto_suki",
        sentAt: input.status === "sent" ? new Date() : null,
      })
      .returning();
    return created!;
  }
}
