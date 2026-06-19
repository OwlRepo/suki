import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { getDb } from "@tyvera/database";
import { sql } from "drizzle-orm";
import {
  MANUAL_FOLLOW_UP_AUTOMATION_KEYS,
  SEMAPHORE_RECONCILIATION_BATCH_SIZE,
  SEMAPHORE_RECONCILIATION_CRON,
  SEMAPHORE_RECONCILIATION_LOOKBACK_HOURS,
} from "./manual-follow-ups/manual-follow-up.constants";
import { ManualFollowUpService } from "./manual-follow-ups/manual-follow-up.service";
import { AutomationJobRunService } from "../operations/automation-job-run.service";

interface ReconciliationEvent {
  id: string;
  businessId: string;
  organizationId: string;
  content: string;
  providerMessageId: string | null;
  providerMetadata: Record<string, unknown> | null;
}

type SentMarkerTarget =
  | {
      table: "appointments";
      column:
        | "confirmation_sent_at"
        | "reminder_24h_sent_at"
        | "reminder_72h_sent_at"
        | "missed_recovery_sent_at";
      idField: "appointmentId";
    }
  | {
      table: "customers";
      column:
        | "post_visit_followup_sent_at"
        | "inactivity_winback_sent_at"
        | "loyalty_unlock_sent_at";
      idField: "customerId";
    };

const SENT_MARKER_TARGETS: Record<string, SentMarkerTarget> = {
  appointment_confirmation: {
    table: "appointments",
    column: "confirmation_sent_at",
    idField: "appointmentId",
  },
  appointment_reminder_24h: {
    table: "appointments",
    column: "reminder_24h_sent_at",
    idField: "appointmentId",
  },
  appointment_reminder_72h: {
    table: "appointments",
    column: "reminder_72h_sent_at",
    idField: "appointmentId",
  },
  missed_recovery: {
    table: "appointments",
    column: "missed_recovery_sent_at",
    idField: "appointmentId",
  },
  post_visit_followup: {
    table: "customers",
    column: "post_visit_followup_sent_at",
    idField: "customerId",
  },
  inactivity_winback: {
    table: "customers",
    column: "inactivity_winback_sent_at",
    idField: "customerId",
  },
  loyalty_unlock: {
    table: "customers",
    column: "loyalty_unlock_sent_at",
    idField: "customerId",
  },
};

export function getAutomationSentMarkerTarget(
  automationKey: string,
): SentMarkerTarget | null {
  return SENT_MARKER_TARGETS[automationKey] ?? null;
}

export function stripKnownAutomationFooter(body: string): string {
  const footer = " Sent automatically by Tyvera";
  return body.endsWith(footer) ? body.slice(0, -footer.length) : body;
}

export function extractSemaphoreMessageId(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  const messageId = metadata?.message_id;
  if (typeof messageId === "string" && messageId.trim()) {
    return messageId.trim();
  }
  if (typeof messageId === "number" && Number.isFinite(messageId)) {
    return String(messageId);
  }
  return null;
}

@Injectable()
export class SemaphoreMessageReconciliationService {
  constructor(
    private readonly manualFollowUps: ManualFollowUpService,
    private readonly jobRuns: AutomationJobRunService,
  ) {}

  @Cron(SEMAPHORE_RECONCILIATION_CRON)
  async runScheduledReconciliation() {
    if (process.env.SEMAPHORE_RECONCILIATION_ENABLED !== "true") return;
    await this.jobRuns.record("semaphore_reconciliation", async () => {
      const result = await this.reconcileRecentMessages();
      return {
        processedCount: result.checked,
        successCount: Math.max(0, result.checked - result.failed),
        failureCount: result.failed,
        result,
      };
    });
  }

  async reconcileRecentMessages(): Promise<{
    checked: number;
    failed: number;
    repaired: number;
  }> {
    const apiKey = process.env.SEMAPHORE_API_KEY?.trim();
    if (!apiKey) return { checked: 0, failed: 0, repaired: 0 };

    const db = getDb();
    const lookback = new Date(
      Date.now() - SEMAPHORE_RECONCILIATION_LOOKBACK_HOURS * 60 * 60 * 1000,
    );
    const automationKeyFilter = sql.join(
      [...MANUAL_FOLLOW_UP_AUTOMATION_KEYS].map((key) => sql`${key}`),
      sql`, `,
    );
    const events = (await db.execute(sql`
      select
        me.id,
        me.business_id as "businessId",
        b.organization_id as "organizationId",
        me.content,
        me.provider_message_id as "providerMessageId",
        me.provider_metadata as "providerMetadata"
      from message_events me
      inner join businesses b on b.id = me.business_id
      where
        me.channel = 'sms'
        and me.provider = 'semaphore'
        and (
          (
            me.created_at >= ${lookback}
            and me.automation_key in (${automationKeyFilter})
            and me.provider_message_id is not null
            and me.delivery_status is distinct from 'failed'
          )
          or (
            me.status = 'failed'
            and me.failure_reason = 'provider_rejected'
            and me.provider_message_id is null
            and jsonb_exists(me.provider_metadata, 'message_id')
          )
        )
      order by me.created_at asc
      limit ${SEMAPHORE_RECONCILIATION_BATCH_SIZE}
    `)) as unknown as ReconciliationEvent[];

    let failed = 0;
    let repaired = 0;
    for (const event of events) {
      const messageId =
        event.providerMessageId ??
        extractSemaphoreMessageId(event.providerMetadata);
      if (!messageId) continue;

      const rawStatus = await this.fetchSemaphoreStatus(apiKey, messageId);
      const mapped = this.mapSemaphoreStatus(rawStatus);
      if (!mapped) continue;

      if (!event.providerMessageId) {
        if (mapped === "failed") {
          failed += 1;
          await this.markConfirmedFailure(event, messageId, rawStatus!);
        } else if (
          await this.repairFalseRejection(event.id, messageId, mapped)
        ) {
          repaired += 1;
        }
        continue;
      }

      if (mapped === "failed") {
        failed += 1;
        await this.markConfirmedFailure(event, messageId, rawStatus!);
      } else {
        await db.execute(sql`
          update message_events
          set delivery_status = ${mapped}
          where id = ${event.id}
            and delivery_status is distinct from 'failed'
        `);
      }
    }

    return { checked: events.length, failed, repaired };
  }

  private async repairFalseRejection(
    eventId: string,
    messageId: string,
    deliveryStatus: "queued" | "sent",
  ): Promise<boolean> {
    const db = getDb();
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${eventId}, 0))`,
      );
      const repaired = (await tx.execute(sql`
        with candidate as (
          select
            me.id,
            me.business_id,
            me.customer_id,
            me.appointment_id,
            me.automation_key,
            me.created_at,
            b.organization_id,
            greatest(
              coalesce(
                nullif(me.provider_metadata->>'estimatedSegments', '')::int,
                1
              ),
              1
            ) as units
          from message_events me
          inner join businesses b on b.id = me.business_id
          where me.id = ${eventId}
            and me.provider = 'semaphore'
            and me.status = 'failed'
            and me.failure_reason = 'provider_rejected'
            and me.provider_message_id is null
          for update
        ),
        usage_insert as (
          insert into sms_usage_events (
            message_event_id,
            organization_id,
            business_id,
            units,
            status
          )
          select
            c.id,
            c.organization_id,
            c.business_id,
            c.units,
            'consumed'
          from candidate c
          where not exists (
            select 1
            from sms_usage_events sue
            where sue.message_event_id = c.id
          )
          returning organization_id, units
        ),
        credit_update as (
          update sms_credits sc
          set
            used = sc.used + ui.units,
            updated_at = now()
          from usage_insert ui, candidate c
          where sc.organization_id = ui.organization_id
            and sc.month = to_char(c.created_at at time zone 'UTC', 'YYYY-MM')
          returning sc.organization_id
        ),
        task_update as (
          update manual_follow_up_tasks task
          set
            status = 'dismissed',
            failure_reason = 'false_provider_rejection_repaired',
            resolved_at = now(),
            updated_at = now()
          from candidate c
          where task.original_message_event_id = c.id
            and task.status = 'open'
          returning task.id
        )
        update message_events me
        set
          status = 'sent',
          delivery_status = ${deliveryStatus},
          provider_message_id = ${messageId},
          failure_reason = null,
          sent_at = coalesce(me.sent_at, me.created_at)
        from candidate c
        where me.id = c.id
        returning
          me.id as repaired,
          c.automation_key as "automationKey",
          c.appointment_id as "appointmentId",
          c.customer_id as "customerId",
          c.created_at as "createdAt"
      `)) as unknown as Array<{
        repaired: string;
        automationKey: string;
        appointmentId: string | null;
        customerId: string;
        createdAt: Date;
      }>;
      if (repaired[0]) {
        await this.restoreSentMarker(tx, repaired[0]);
      }
      return repaired.length > 0;
    });
  }

  private async restoreSentMarker(
    tx: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> },
    event: {
      automationKey: string;
      appointmentId: string | null;
      customerId: string;
      createdAt: Date;
    },
  ): Promise<void> {
    const target = getAutomationSentMarkerTarget(event.automationKey);
    if (!target) return;
    const targetId =
      target.idField === "appointmentId"
        ? event.appointmentId
        : event.customerId;
    if (!targetId) return;

    await tx.execute(sql`
      update ${sql.identifier(target.table)}
      set
        ${sql.identifier(target.column)} = coalesce(
          ${sql.identifier(target.column)},
          ${event.createdAt}
        ),
        updated_at = now()
      where id = ${targetId}
    `);
  }

  private async markConfirmedFailure(
    event: ReconciliationEvent,
    messageId: string,
    rawStatus: string,
  ): Promise<void> {
    const reason =
      rawStatus === "refunded" ? "semaphore_refunded" : "semaphore_failed";
    const db = getDb();
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${event.id}, 0))`,
      );
      await tx.execute(sql`
        with event_update as (
          update message_events
          set
            status = 'failed',
            delivery_status = 'failed',
            provider_message_id = coalesce(provider_message_id, ${messageId}),
            failure_reason = ${reason}
          where id = ${event.id}
          returning id
        )
        update manual_follow_up_tasks task
        set
          failure_reason = ${reason},
          updated_at = now()
        from event_update event
        where task.original_message_event_id = event.id
      `);
    });
    await this.manualFollowUps.createFromMessageEvent({
      organizationId: event.organizationId,
      businessId: event.businessId,
      originalMessageEventId: event.id,
      manualRetryRawMessage: stripKnownAutomationFooter(event.content),
      fallbackFailureReason: reason,
    });
  }

  async fetchSemaphoreStatus(
    apiKey: string,
    messageId: string,
  ): Promise<string | null> {
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
