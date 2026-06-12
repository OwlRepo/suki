import { Injectable, NotFoundException } from "@nestjs/common";
import {
  appointments,
  businesses,
  customers,
  getDb,
  manualFollowUpTasks,
  messageEvents,
} from "@tyvera/database";
import type { AutomationKey, MessagePurpose } from "@tyvera/types";
import { and, eq, isNull, sql } from "drizzle-orm";
import { MANUAL_FOLLOW_UP_AUTOMATION_KEY_SET } from "./manual-follow-up.constants";
import type {
  AttachRetryMessageEventInput,
  CreateManualFollowUpFromEventInput,
  ManualFollowUpStatus,
  ManualFollowUpTaskView,
  ResolveManualFollowUpInput,
} from "./manual-follow-up.types";

@Injectable()
export class ManualFollowUpService {
  async createFromMessageEvent(input: CreateManualFollowUpFromEventInput) {
    const db = getDb();

    const [event] = await db
      .select({
        id: messageEvents.id,
        businessId: messageEvents.businessId,
        customerId: messageEvents.customerId,
        appointmentId: messageEvents.appointmentId,
        automationKey: messageEvents.automationKey,
        channel: messageEvents.channel,
        content: messageEvents.content,
        failureReason: messageEvents.failureReason,
        mobile: customers.mobile,
        organizationId: businesses.organizationId,
      })
      .from(messageEvents)
      .innerJoin(businesses, eq(messageEvents.businessId, businesses.id))
      .innerJoin(customers, eq(messageEvents.customerId, customers.id))
      .where(
        and(
          eq(messageEvents.id, input.originalMessageEventId),
          eq(messageEvents.businessId, input.businessId),
          eq(businesses.organizationId, input.organizationId),
        ),
      )
      .limit(1);

    if (!event) throw new NotFoundException("Message event not found");
    if (event.channel !== "sms") return null;
    if (!MANUAL_FOLLOW_UP_AUTOMATION_KEY_SET.has(event.automationKey)) return null;
    if (!event.mobile?.trim()) return null;

    const [created] = await db
      .insert(manualFollowUpTasks)
      .values({
        organizationId: input.organizationId,
        businessId: event.businessId,
        originalMessageEventId: event.id,
        customerId: event.customerId,
        appointmentId: event.appointmentId,
        recipientMobile: event.mobile.trim(),
        messageBody: event.content,
        manualRetryRawMessage: input.manualRetryRawMessage.trim(),
        failureReason:
          event.failureReason ?? input.fallbackFailureReason ?? "sms_send_failed",
      })
      .onConflictDoNothing({
        target: manualFollowUpTasks.originalMessageEventId,
      })
      .returning();

    if (created) return created;

    const [existing] = await db
      .select()
      .from(manualFollowUpTasks)
      .where(eq(manualFollowUpTasks.originalMessageEventId, event.id))
      .limit(1);

    return existing ?? null;
  }

  async list(input: {
    organizationId: string;
    status?: ManualFollowUpStatus;
  }): Promise<ManualFollowUpTaskView[]> {
    const db = getDb();
    const filters = [eq(manualFollowUpTasks.organizationId, input.organizationId)];
    if (input.status) {
      filters.push(eq(manualFollowUpTasks.status, input.status));
    }

    const rows = await db
      .select({
        id: manualFollowUpTasks.id,
        organizationId: manualFollowUpTasks.organizationId,
        businessId: manualFollowUpTasks.businessId,
        originalMessageEventId: manualFollowUpTasks.originalMessageEventId,
        retryMessageEventId: manualFollowUpTasks.retryMessageEventId,
        customerId: manualFollowUpTasks.customerId,
        appointmentId: manualFollowUpTasks.appointmentId,
        automationKey: messageEvents.automationKey,
        purpose: messageEvents.purpose,
        status: manualFollowUpTasks.status,
        recipientMobile: manualFollowUpTasks.recipientMobile,
        messageBody: manualFollowUpTasks.messageBody,
        manualRetryRawMessage: manualFollowUpTasks.manualRetryRawMessage,
        failureReason: manualFollowUpTasks.failureReason,
        notifiedAt: manualFollowUpTasks.notifiedAt,
        createdAt: manualFollowUpTasks.createdAt,
        customerName: customers.name,
        businessName: businesses.name,
        appointmentScheduledAt: appointments.scheduledAt,
      })
      .from(manualFollowUpTasks)
      .innerJoin(
        messageEvents,
        eq(manualFollowUpTasks.originalMessageEventId, messageEvents.id),
      )
      .innerJoin(customers, eq(manualFollowUpTasks.customerId, customers.id))
      .innerJoin(businesses, eq(manualFollowUpTasks.businessId, businesses.id))
      .leftJoin(
        appointments,
        eq(manualFollowUpTasks.appointmentId, appointments.id),
      )
      .where(and(...filters));

    return rows.map((row) => ({
      ...row,
      automationKey: row.automationKey as AutomationKey,
      purpose: row.purpose as MessagePurpose,
      duplicateRisk: row.failureReason === "provider_outcome_unknown",
    }));
  }

  async countOpen(organizationId: string): Promise<{ count: number }> {
    const db = getDb();
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(manualFollowUpTasks)
      .where(
        and(
          eq(manualFollowUpTasks.organizationId, organizationId),
          eq(manualFollowUpTasks.status, "open"),
        ),
      );
    return { count: Number(row?.count ?? 0) };
  }

  async getOpenSummary(organizationId: string): Promise<{
    open: number;
    duplicateRisk: number;
    byFailureReason: Array<{ reason: string; count: number }>;
  }> {
    const db = getDb();
    const rows = await db
      .select({
        reason: manualFollowUpTasks.failureReason,
        count: sql<number>`count(*)::int`,
        duplicateRisk: sql<number>`sum(case when ${manualFollowUpTasks.failureReason} = 'provider_outcome_unknown' then 1 else 0 end)::int`,
      })
      .from(manualFollowUpTasks)
      .where(
        and(
          eq(manualFollowUpTasks.organizationId, organizationId),
          eq(manualFollowUpTasks.status, "open"),
        ),
      )
      .groupBy(manualFollowUpTasks.failureReason);

    return {
      open: rows.reduce((sum, row) => sum + Number(row.count ?? 0), 0),
      duplicateRisk: rows.reduce(
        (sum, row) => sum + Number(row.duplicateRisk ?? 0),
        0,
      ),
      byFailureReason: rows.map((row) => ({
        reason: row.reason || "unknown",
        count: Number(row.count ?? 0),
      })),
    };
  }

  async getOpenTask(
    organizationId: string,
    taskId: string,
  ): Promise<ManualFollowUpTaskView> {
    const allOpen = await this.list({ organizationId, status: "open" });
    const exact = allOpen.find((row) => row.id === taskId);
    if (!exact) throw new NotFoundException("Manual follow-up task not found");
    return exact;
  }

  async resolve(input: ResolveManualFollowUpInput) {
    const db = getDb();
    const [updated] = await db
      .update(manualFollowUpTasks)
      .set({
        status: input.status,
        resolvedAt: new Date(),
        resolvedByUserId: input.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(manualFollowUpTasks.id, input.taskId),
          eq(manualFollowUpTasks.organizationId, input.organizationId),
          eq(manualFollowUpTasks.status, "open"),
        ),
      )
      .returning();
    if (!updated) throw new NotFoundException("Manual follow-up task not found");
    return updated;
  }

  async attachRetryMessageEvent(input: AttachRetryMessageEventInput) {
    const db = getDb();
    const [updated] = await db
      .update(manualFollowUpTasks)
      .set({
        retryMessageEventId: input.retryMessageEventId,
        status: "contacted",
        resolvedAt: new Date(),
        resolvedByUserId: input.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(manualFollowUpTasks.id, input.taskId),
          eq(manualFollowUpTasks.organizationId, input.organizationId),
          eq(manualFollowUpTasks.status, "open"),
        ),
      )
      .returning();
    if (!updated) throw new NotFoundException("Manual follow-up task not found");
    return updated;
  }

  async markNotified(organizationId: string, taskIds: string[]) {
    if (taskIds.length === 0) return;
    const db = getDb();
    await db
      .update(manualFollowUpTasks)
      .set({ notifiedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(manualFollowUpTasks.organizationId, organizationId),
          isNull(manualFollowUpTasks.notifiedAt),
          sql`${manualFollowUpTasks.id} = any(${taskIds}::uuid[])`,
        ),
      );
  }
}
