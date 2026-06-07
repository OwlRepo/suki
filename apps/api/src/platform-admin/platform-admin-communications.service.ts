import { Injectable, NotFoundException } from "@nestjs/common";
import { getDb } from "@tyvera/database";
import type {
  DeliveryStatus,
  MessageChannel,
  MessageEventStatus,
  MessagePurpose,
} from "@tyvera/types";
import { sql, type SQL } from "drizzle-orm";
import { maskRecipient, toIsoString } from "./platform-admin-communications.util";

type CommunicationsRange = "24h" | "7d" | "30d";

type CommunicationsListQuery = {
  channel?: MessageChannel;
  provider?: string;
  deliveryStatus?: DeliveryStatus;
  automationKey?: string;
  organizationId?: string;
  businessId?: string;
  from?: string;
  to?: string;
  page?: number | string;
  limit?: number | string;
};

type CommunicationsSummaryQuery = {
  range?: CommunicationsRange;
  organizationId?: string;
  businessId?: string;
};

type CommunicationRow = {
  id: string;
  organizationId: string;
  organizationName: string;
  businessId: string;
  businessName: string;
  appointmentId: string | null;
  customerId: string;
  customerName: string;
  recipientRaw: string | null;
  channel: MessageChannel;
  automationKey: string;
  purpose: MessagePurpose;
  status: MessageEventStatus;
  deliveryStatus: DeliveryStatus | null;
  provider: string | null;
  providerMessageId?: string | null;
  retryCount: number;
  unitsConsumed: number;
  failureReason: string | null;
  sentAt: Date | string | null;
  createdAt: Date | string;
};

type SummaryTotalsRow = {
  smsQueued?: number;
  smsSent?: number;
  smsFailed?: number;
  smsDelivered?: number;
  emailSent?: number;
  emailDelivered?: number;
  emailFailed?: number;
  emailBounced?: number;
  emailRejected?: number;
};

type SummarySeriesRow = {
  bucket: Date | string;
  smsSent?: number;
  smsFailed?: number;
  emailDelivered?: number;
  emailFailed?: number;
  otpFailures?: number;
};

type DbWithExecute = {
  execute: <T = Record<string, unknown>>(query: SQL) => Promise<T[]>;
};

@Injectable()
export class PlatformAdminCommunicationsService {
  async listCommunications(query: CommunicationsListQuery = {}) {
    const db = getDb() as unknown as DbWithExecute;
    const page = parsePositiveInt(query.page, 1);
    const limit = Math.min(parsePositiveInt(query.limit, 25), 100);
    const offset = (page - 1) * limit;
    const filters = this.buildMessageFilters(query);
    const whereSql = this.combineFilters(filters);

    const [countRow] = await db.execute<{ total: number }>(sql`
      select count(*)::int as "total"
      from message_events me
      inner join businesses b on b.id = me.business_id
      inner join organizations o on o.id = b.organization_id
      inner join customers c on c.id = me.customer_id
      where ${whereSql}
    `);

    const rows = await db.execute<CommunicationRow>(sql`
      select
        me.id,
        o.id as "organizationId",
        o.name as "organizationName",
        b.id as "businessId",
        b.name as "businessName",
        me.appointment_id as "appointmentId",
        c.id as "customerId",
        c.name as "customerName",
        case when me.channel = 'email' then c.email else c.mobile end as "recipientRaw",
        me.channel,
        me.automation_key as "automationKey",
        me.purpose,
        me.status,
        me.delivery_status as "deliveryStatus",
        me.provider,
        me.retry_count as "retryCount",
        coalesce(sms_units.units, email_units.units, 0)::int as "unitsConsumed",
        me.failure_reason as "failureReason",
        me.sent_at as "sentAt",
        me.created_at as "createdAt"
      from message_events me
      inner join businesses b on b.id = me.business_id
      inner join organizations o on o.id = b.organization_id
      inner join customers c on c.id = me.customer_id
      left join (
        select message_event_id, coalesce(sum(units), 0)::int as units
        from sms_usage_events
        group by message_event_id
      ) sms_units on sms_units.message_event_id = me.id
      left join (
        select message_event_id, coalesce(sum(units), 0)::int as units
        from email_usage_events
        group by message_event_id
      ) email_units on email_units.message_event_id = me.id
      where ${whereSql}
      order by me.created_at desc
      limit ${limit}
      offset ${offset}
    `);

    const total = Number(countRow?.total ?? 0);
    return {
      items: rows.map((row) => this.serializeListRow(row)),
      pagination: {
        page,
        limit,
        total,
        totalPages: total > 0 ? Math.ceil(total / limit) : 0,
      },
    };
  }

  async getSummary(query: CommunicationsSummaryQuery = {}) {
    const db = getDb() as unknown as DbWithExecute;
    const range = this.normalizeRange(query.range);
    const start = this.getRangeStart(range);
    const bucketUnit = range === "24h" ? "hour" : "day";
    const messageFilters = this.buildMessageFilters({
      organizationId: query.organizationId,
      businessId: query.businessId,
      from: start.toISOString(),
    });
    const whereMessages = this.combineFilters(messageFilters);
    const scopedFilters = this.buildScopedFilters({
      organizationId: query.organizationId,
      businessId: query.businessId,
      from: start.toISOString(),
    });
    const whereScoped = this.combineFilters(scopedFilters);
    const bucketExpr = sql.raw(`date_trunc('${bucketUnit}',`);

    const [totalsRow] = await db.execute<SummaryTotalsRow>(sql`
      select
        coalesce(sum(case when me.channel = 'sms' and coalesce(me.delivery_status, me.status) = 'queued' then 1 else 0 end), 0)::int as "smsQueued",
        coalesce(sum(case when me.channel = 'sms' and me.status = 'sent' then 1 else 0 end), 0)::int as "smsSent",
        coalesce(sum(case when me.channel = 'sms' and (me.status = 'failed' or me.delivery_status = 'failed') then 1 else 0 end), 0)::int as "smsFailed",
        coalesce(sum(case when me.channel = 'sms' and me.delivery_status = 'delivered' then 1 else 0 end), 0)::int as "smsDelivered",
        coalesce(sum(case when me.channel = 'email' and me.status = 'sent' then 1 else 0 end), 0)::int as "emailSent",
        coalesce(sum(case when me.channel = 'email' and me.delivery_status = 'delivered' then 1 else 0 end), 0)::int as "emailDelivered",
        coalesce(sum(case when me.channel = 'email' and (me.status = 'failed' or me.delivery_status = 'failed') then 1 else 0 end), 0)::int as "emailFailed",
        coalesce(sum(case when me.channel = 'email' and me.delivery_status = 'bounced' then 1 else 0 end), 0)::int as "emailBounced",
        coalesce(sum(case when me.channel = 'email' and me.delivery_status = 'rejected' then 1 else 0 end), 0)::int as "emailRejected"
      from message_events me
      inner join businesses b on b.id = me.business_id
      inner join organizations o on o.id = b.organization_id
      where ${whereMessages}
    `);

    const [followUpRow] = await db.execute<{ openManualFollowUps: number }>(sql`
      select count(*)::int as "openManualFollowUps"
      from manual_follow_up_tasks task
      where task.status = 'open'
        and ${whereScoped}
    `);

    const [otpRow] = await db.execute<{ otpSendFailures: number; otpTotal: number }>(sql`
      select
        coalesce(sum(case when otp.outcome <> 'sent' then 1 else 0 end), 0)::int as "otpSendFailures",
        count(*)::int as "otpTotal"
      from public_otp_send_events otp
      where ${whereScoped}
    `);

    const seriesRows = await db.execute<SummarySeriesRow>(sql`
      with message_buckets as (
        select
          ${bucketExpr} me.created_at) as bucket,
          coalesce(sum(case when me.channel = 'sms' and me.status = 'sent' then 1 else 0 end), 0)::int as "smsSent",
          coalesce(sum(case when me.channel = 'sms' and (me.status = 'failed' or me.delivery_status = 'failed') then 1 else 0 end), 0)::int as "smsFailed",
          coalesce(sum(case when me.channel = 'email' and me.delivery_status = 'delivered' then 1 else 0 end), 0)::int as "emailDelivered",
          coalesce(sum(case when me.channel = 'email' and (me.status = 'failed' or me.delivery_status = 'failed') then 1 else 0 end), 0)::int as "emailFailed"
        from message_events me
        inner join businesses b on b.id = me.business_id
        inner join organizations o on o.id = b.organization_id
        where ${whereMessages}
        group by bucket
      ),
      otp_buckets as (
        select
          ${bucketExpr} otp.created_at) as bucket,
          coalesce(sum(case when otp.outcome <> 'sent' then 1 else 0 end), 0)::int as "otpFailures"
        from public_otp_send_events otp
        where ${whereScoped}
        group by bucket
      )
      select
        coalesce(message_buckets.bucket, otp_buckets.bucket) as bucket,
        coalesce(message_buckets."smsSent", 0)::int as "smsSent",
        coalesce(message_buckets."smsFailed", 0)::int as "smsFailed",
        coalesce(message_buckets."emailDelivered", 0)::int as "emailDelivered",
        coalesce(message_buckets."emailFailed", 0)::int as "emailFailed",
        coalesce(otp_buckets."otpFailures", 0)::int as "otpFailures"
      from message_buckets
      full outer join otp_buckets on otp_buckets.bucket = message_buckets.bucket
      order by bucket asc
    `);

    const totals = {
      smsQueued: numberFrom(totalsRow?.smsQueued),
      smsSent: numberFrom(totalsRow?.smsSent),
      smsFailed: numberFrom(totalsRow?.smsFailed),
      smsDelivered: numberFrom(totalsRow?.smsDelivered),
      emailSent: numberFrom(totalsRow?.emailSent),
      emailDelivered: numberFrom(totalsRow?.emailDelivered),
      emailFailed: numberFrom(totalsRow?.emailFailed),
      emailBounced: numberFrom(totalsRow?.emailBounced),
      emailRejected: numberFrom(totalsRow?.emailRejected),
      openManualFollowUps: numberFrom(followUpRow?.openManualFollowUps),
      otpSendFailures: numberFrom(otpRow?.otpSendFailures),
    };

    return {
      range,
      totals,
      failureRates: {
        smsFailureRatePct: pct(totals.smsFailed, totals.smsSent + totals.smsFailed),
        emailFailureRatePct: pct(totals.emailFailed, totals.emailSent + totals.emailFailed),
        otpFailureRatePct: pct(totals.otpSendFailures, numberFrom(otpRow?.otpTotal)),
      },
      series: seriesRows.map((row) => ({
        bucket: toIsoString(row.bucket) ?? String(row.bucket),
        smsSent: numberFrom(row.smsSent),
        smsFailed: numberFrom(row.smsFailed),
        emailDelivered: numberFrom(row.emailDelivered),
        emailFailed: numberFrom(row.emailFailed),
        otpFailures: numberFrom(row.otpFailures),
      })),
    };
  }

  async getCommunicationDetail(messageEventId: string) {
    const db = getDb() as unknown as DbWithExecute;
    const [row] = await db.execute<CommunicationRow>(sql`
      select
        me.id,
        o.id as "organizationId",
        o.name as "organizationName",
        b.id as "businessId",
        b.name as "businessName",
        me.appointment_id as "appointmentId",
        c.id as "customerId",
        c.name as "customerName",
        case when me.channel = 'email' then c.email else c.mobile end as "recipientRaw",
        me.automation_key as "automationKey",
        me.purpose,
        me.channel,
        me.status,
        me.delivery_status as "deliveryStatus",
        me.provider,
        me.provider_message_id as "providerMessageId",
        me.retry_count as "retryCount",
        coalesce(sms_units.units, email_units.units, 0)::int as "unitsConsumed",
        me.failure_reason as "failureReason",
        me.sent_at as "sentAt",
        me.created_at as "createdAt"
      from message_events me
      inner join businesses b on b.id = me.business_id
      inner join organizations o on o.id = b.organization_id
      inner join customers c on c.id = me.customer_id
      left join (
        select message_event_id, coalesce(sum(units), 0)::int as units
        from sms_usage_events
        group by message_event_id
      ) sms_units on sms_units.message_event_id = me.id
      left join (
        select message_event_id, coalesce(sum(units), 0)::int as units
        from email_usage_events
        group by message_event_id
      ) email_units on email_units.message_event_id = me.id
      where me.id = ${messageEventId}
      limit 1
    `);

    if (!row) {
      throw new NotFoundException("Message event not found");
    }

    const [task] = await db.execute<{
      id: string;
      status: "open" | "contacted" | "dismissed";
      failureReason: string;
      createdAt: Date | string;
      resolvedAt: Date | string | null;
    }>(sql`
      select
        id,
        status,
        failure_reason as "failureReason",
        created_at as "createdAt",
        resolved_at as "resolvedAt"
      from manual_follow_up_tasks
      where original_message_event_id = ${messageEventId}
      limit 1
    `);

    return {
      id: row.id,
      organization: {
        id: row.organizationId,
        name: row.organizationName,
      },
      business: {
        id: row.businessId,
        name: row.businessName,
      },
      customer: {
        id: row.customerId,
        name: row.customerName,
        recipientMasked: maskRecipient(row.recipientRaw),
      },
      appointmentId: row.appointmentId,
      automationKey: row.automationKey,
      purpose: row.purpose,
      channel: row.channel,
      status: row.status,
      deliveryStatus: row.deliveryStatus,
      provider: row.provider,
      providerMessageId: row.providerMessageId ?? null,
      retryCount: numberFrom(row.retryCount),
      unitsConsumed: numberFrom(row.unitsConsumed),
      failureReason: row.failureReason,
      sentAt: toIsoString(row.sentAt),
      createdAt: toIsoString(row.createdAt) ?? "",
      manualFollowUpTask: task
        ? {
            id: task.id,
            status: task.status,
            failureReason: task.failureReason,
            createdAt: toIsoString(task.createdAt) ?? "",
            resolvedAt: toIsoString(task.resolvedAt),
          }
        : null,
    };
  }

  private serializeListRow(row: CommunicationRow) {
    return {
      id: row.id,
      organizationId: row.organizationId,
      organizationName: row.organizationName,
      businessId: row.businessId,
      businessName: row.businessName,
      appointmentId: row.appointmentId,
      customerId: row.customerId,
      customerName: row.customerName,
      recipientMasked: maskRecipient(row.recipientRaw),
      channel: row.channel,
      automationKey: row.automationKey,
      purpose: row.purpose,
      status: row.status,
      deliveryStatus: row.deliveryStatus,
      provider: row.provider,
      retryCount: numberFrom(row.retryCount),
      unitsConsumed: numberFrom(row.unitsConsumed),
      failureReason: row.failureReason,
      sentAt: toIsoString(row.sentAt),
      createdAt: toIsoString(row.createdAt) ?? "",
    };
  }

  private normalizeRange(range?: string | null): CommunicationsRange {
    return range === "7d" || range === "30d" || range === "24h" ? range : "24h";
  }

  private getRangeStart(range: CommunicationsRange) {
    const now = Date.now();
    const hours = range === "24h" ? 24 : range === "7d" ? 24 * 7 : 24 * 30;
    return new Date(now - hours * 60 * 60 * 1000);
  }

  private buildMessageFilters(query: CommunicationsListQuery) {
    const filters: SQL[] = [];
    if (query.channel === "sms" || query.channel === "email") {
      filters.push(sql`me.channel = ${query.channel}`);
    }
    if (query.provider?.trim()) {
      filters.push(sql`me.provider = ${query.provider.trim()}`);
    }
    if (isDeliveryStatus(query.deliveryStatus)) {
      filters.push(sql`me.delivery_status = ${query.deliveryStatus}`);
    }
    if (query.automationKey?.trim()) {
      filters.push(sql`me.automation_key = ${query.automationKey.trim()}`);
    }
    if (query.organizationId?.trim()) {
      filters.push(sql`b.organization_id = ${query.organizationId.trim()}`);
    }
    if (query.businessId?.trim()) {
      filters.push(sql`me.business_id = ${query.businessId.trim()}`);
    }
    const from = parseDate(query.from);
    if (from) filters.push(sql`me.created_at >= ${from}`);
    const to = parseDate(query.to);
    if (to) filters.push(sql`me.created_at <= ${to}`);
    return filters;
  }

  private buildScopedFilters(query: {
    organizationId?: string;
    businessId?: string;
    from?: string;
  }) {
    const filters: SQL[] = [];
    if (query.organizationId?.trim()) {
      filters.push(sql`organization_id = ${query.organizationId.trim()}`);
    }
    if (query.businessId?.trim()) {
      filters.push(sql`business_id = ${query.businessId.trim()}`);
    }
    const from = parseDate(query.from);
    if (from) filters.push(sql`created_at >= ${from}`);
    return filters;
  }

  private combineFilters(filters: SQL[]) {
    if (filters.length === 0) return sql`true`;
    return sql.join(filters, sql` and `);
  }
}

function parsePositiveInt(value: number | string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parseDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function numberFrom(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function pct(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function isDeliveryStatus(value: unknown): value is DeliveryStatus {
  return (
    value === "queued" ||
    value === "sent" ||
    value === "delivered" ||
    value === "failed" ||
    value === "bounced" ||
    value === "rejected"
  );
}
