import { Injectable, NotFoundException, Optional } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { getDb, operationsAlerts } from "@tyvera/database";
import type {
  OperationsAlertSeverity,
  OperationsAlertStatus,
} from "@tyvera/types";
import { and, desc, eq, gte, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import {
  EXPECTED_JOB_INTERVALS,
  OPERATIONS_PROVIDER_HEALTH_CRON,
  type ExpectedJobKey,
} from "./operations.constants";
import { FeatureFlagsService } from "../common/feature-flags.service";

type AlertCondition = {
  alertKey: string;
  severity: OperationsAlertSeverity;
  provider?: string | null;
  title: string;
  description: string;
  metadata?: Record<string, unknown> | null;
};

type DbWithExecute = {
  execute: <T = Record<string, unknown>>(query: SQL) => Promise<T[]>;
};

@Injectable()
export class OperationsAlertService {
  constructor(
    @Optional() private readonly featureFlags?: FeatureFlagsService,
  ) {}

  @Cron(OPERATIONS_PROVIDER_HEALTH_CRON)
  async evaluateScheduledAlerts() {
    await this.evaluateRecentMessagingAlerts();
    await this.evaluateMissingAutomationRuns({
      autoFollowupsSchedulerEnabled:
        this.featureFlags?.autoFollowupsSchedulerEnabled() ?? false,
      semaphoreReconciliationEnabled:
        process.env.SEMAPHORE_RECONCILIATION_ENABLED === "true" &&
        !!process.env.SEMAPHORE_API_KEY?.trim(),
    });
  }

  async evaluateSemaphoreCreditBalance(input: {
    balance: number | null;
    warningThreshold: number;
    criticalThreshold: number;
  }) {
    if (input.balance === null) {
      await this.resolveAlerts([
        "semaphore_credits_warning",
        "semaphore_credits_critical",
      ]);
      return;
    }

    if (input.balance < input.criticalThreshold) {
      await this.openAlert({
        alertKey: "semaphore_credits_critical",
        severity: "critical",
        provider: "semaphore",
        title: "Semaphore credits are critically low",
        description:
          "Semaphore credit balance is below the critical threshold.",
        metadata: {
          balance: input.balance,
          warningThreshold: input.warningThreshold,
          criticalThreshold: input.criticalThreshold,
        },
      });
      await this.resolveAlerts(["semaphore_credits_warning"]);
      return;
    }

    if (input.balance < input.warningThreshold) {
      await this.openAlert({
        alertKey: "semaphore_credits_warning",
        severity: "warning",
        provider: "semaphore",
        title: "Semaphore credits are low",
        description: "Semaphore credit balance is below warning threshold.",
        metadata: {
          balance: input.balance,
          warningThreshold: input.warningThreshold,
          criticalThreshold: input.criticalThreshold,
        },
      });
      await this.resolveAlerts(["semaphore_credits_critical"]);
      return;
    }

    await this.resolveAlerts([
      "semaphore_credits_warning",
      "semaphore_credits_critical",
    ]);
  }

  async evaluateSmsFailures(input: { failed: number; total: number }) {
    const failureRatePct = percentage(input.failed, input.total);
    if (input.failed >= 10 && failureRatePct > 40) {
      await this.openAlert({
        alertKey: "sms_outage_suspected",
        severity: "critical",
        provider: "semaphore",
        title: "SMS outage suspected",
        description:
          "SMS failure volume and failure rate are above the outage threshold.",
        metadata: { failed: input.failed, total: input.total, failureRatePct },
      });
      await this.resolveAlerts(["sms_failures_elevated"]);
      return;
    }
    if (input.failed >= 5 && failureRatePct > 15) {
      await this.openAlert({
        alertKey: "sms_failures_elevated",
        severity: "warning",
        provider: "semaphore",
        title: "SMS failures are elevated",
        description:
          "SMS failures are above the warning threshold in the recent window.",
        metadata: { failed: input.failed, total: input.total, failureRatePct },
      });
      await this.resolveAlerts(["sms_outage_suspected"]);
      return;
    }
    await this.resolveAlerts(["sms_failures_elevated", "sms_outage_suspected"]);
  }

  async evaluateEmailFailures(input: { failed: number; total: number }) {
    const failureRatePct = percentage(input.failed, input.total);
    if (input.failed >= 5 && failureRatePct > 15) {
      await this.openAlert({
        alertKey: "email_failures_elevated",
        severity: "warning",
        provider: "resend",
        title: "Email failures are elevated",
        description:
          "Resend email failures are above the warning threshold in the recent window.",
        metadata: { failed: input.failed, total: input.total, failureRatePct },
      });
      return;
    }
    await this.resolveAlerts(["email_failures_elevated"]);
  }

  async evaluateOtpFailures(input: { failed: number }) {
    if (input.failed >= 3) {
      await this.openAlert({
        alertKey: "otp_failures_elevated",
        severity: "critical",
        provider: "otp",
        title: "OTP failures are elevated",
        description:
          "Public booking OTP send failures are above the critical threshold.",
        metadata: { failed: input.failed },
      });
      return;
    }
    await this.resolveAlerts(["otp_failures_elevated"]);
  }

  async evaluateRecentMessagingAlerts() {
    const db = getDb() as unknown as DbWithExecute;
    const smsCutoff = timestampParam(new Date(Date.now() - 15 * 60 * 1000));
    const [sms] = await db.execute<{ failed: number; total: number }>(sql`
      select
        coalesce(sum(case when status = 'failed' or delivery_status = 'failed' then 1 else 0 end), 0)::int as failed,
        count(*)::int as total
      from message_events
      where channel = 'sms'
        and created_at >= ${smsCutoff}::timestamptz
    `);
    await this.evaluateSmsFailures({
      failed: numberFrom(sms?.failed),
      total: numberFrom(sms?.total),
    });

    const emailCutoff = timestampParam(new Date(Date.now() - 30 * 60 * 1000));
    const [email] = await db.execute<{ failed: number; total: number }>(sql`
      select
        coalesce(sum(case when status = 'failed' or delivery_status = 'failed' then 1 else 0 end), 0)::int as failed,
        count(*)::int as total
      from message_events
      where channel = 'email'
        and created_at >= ${emailCutoff}::timestamptz
    `);
    await this.evaluateEmailFailures({
      failed: numberFrom(email?.failed),
      total: numberFrom(email?.total),
    });

    const otpCutoff = timestampParam(new Date(Date.now() - 10 * 60 * 1000));
    const [otp] = await db.execute<{ failed: number }>(sql`
      select count(*)::int as failed
      from public_otp_send_events
      where outcome <> 'sent'
        and created_at >= ${otpCutoff}::timestamptz
    `);
    await this.evaluateOtpFailures({ failed: numberFrom(otp?.failed) });
  }

  async evaluateMissingAutomationRuns(input: {
    autoFollowupsSchedulerEnabled: boolean;
    semaphoreReconciliationEnabled: boolean;
  }) {
    const jobs: ExpectedJobKey[] = [];
    if (input.autoFollowupsSchedulerEnabled) {
      jobs.push("appointment_reminders", "inactivity_winback");
    }
    if (input.semaphoreReconciliationEnabled) {
      jobs.push("semaphore_reconciliation");
    }

    const db = getDb() as unknown as DbWithExecute;
    for (const jobKey of jobs) {
      const interval = EXPECTED_JOB_INTERVALS[jobKey];
      const cutoff = timestampParam(
        new Date(
          Date.now() -
            (interval.expectedEveryMinutes + interval.graceMinutes) *
              60 *
              1000,
        ),
      );
      const rows = await db.execute<{ id: string }>(sql`
        select id
        from automation_job_runs
        where job_key = ${jobKey}
          and status = 'completed'
          and started_at >= ${cutoff}::timestamptz
        limit 1
      `);
      if (rows.length === 0) {
        await this.openAlert({
          alertKey: `automation_run_missing:${jobKey}`,
          severity: "critical",
          provider: null,
          title: `Automation run missing: ${jobKey}`,
          description:
            "An expected automation scheduler run has not completed inside its grace period.",
          metadata: {
            jobKey,
            expectedEveryMinutes: interval.expectedEveryMinutes,
            graceMinutes: interval.graceMinutes,
          },
        });
      } else {
        await this.resolveAlerts([`automation_run_missing:${jobKey}`]);
      }
    }
  }

  async listAutomationRuns(query: {
    jobKey?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: string | number;
    limit?: string | number;
  } = {}) {
    const db = getDb() as unknown as DbWithExecute;
    const page = parsePositiveInt(query.page, 1);
    const limit = Math.min(parsePositiveInt(query.limit, 25), 100);
    const offset = (page - 1) * limit;
    const where = buildAutomationRunWhere(query);
    const [countRow] = await db.execute<{ total: number }>(sql`
      select count(*)::int as total from automation_job_runs where ${where}
    `);
    const rows = await db.execute<Record<string, unknown>>(sql`
      select
        id,
        job_key as "jobKey",
        status,
        processed_count as "processedCount",
        success_count as "successCount",
        failure_count as "failureCount",
        error_summary as "errorSummary",
        started_at as "startedAt",
        finished_at as "finishedAt"
      from automation_job_runs
      where ${where}
      order by started_at desc
      limit ${limit}
      offset ${offset}
    `);
    const failedRunsCutoff = timestampParam(
      new Date(Date.now() - 24 * 60 * 60 * 1000),
    );
    const [summary] = await db.execute<Record<string, unknown>>(sql`
      select
        max(case when job_key = 'appointment_reminders' then started_at end) as "lastAppointmentReminderRun",
        max(case when job_key = 'inactivity_winback' then started_at end) as "lastInactivityWinbackRun",
        max(case when job_key = 'semaphore_reconciliation' then started_at end) as "lastSemaphoreReconciliationRun",
        coalesce(sum(case when status = 'failed' and started_at >= ${failedRunsCutoff}::timestamptz then 1 else 0 end), 0)::int as "failedRunsLast24h"
      from automation_job_runs
    `);
    const total = numberFrom(countRow?.total);
    return {
      items: rows.map(serializeAutomationRun),
      summary: {
        lastAppointmentReminderRun: toIso(summary?.lastAppointmentReminderRun),
        lastInactivityWinbackRun: toIso(summary?.lastInactivityWinbackRun),
        lastSemaphoreReconciliationRun: toIso(
          summary?.lastSemaphoreReconciliationRun,
        ),
        failedRunsLast24h: numberFrom(summary?.failedRunsLast24h),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: total > 0 ? Math.ceil(total / limit) : 0,
      },
    };
  }

  async listAlerts(query: {
    status?: OperationsAlertStatus | "all";
    severity?: OperationsAlertSeverity | "all";
    provider?: string;
    page?: string | number;
    limit?: string | number;
  } = {}) {
    const db = getDb() as unknown as DbWithExecute;
    const page = parsePositiveInt(query.page, 1);
    const limit = Math.min(parsePositiveInt(query.limit, 25), 100);
    const offset = (page - 1) * limit;
    const where = buildAlertWhere(query);
    const [countRow] = await db.execute<{ total: number }>(sql`
      select count(*)::int as total from operations_alerts where ${where}
    `);
    const rows = await db.execute<Record<string, unknown>>(sql`
      select
        id,
        alert_key as "alertKey",
        severity,
        status,
        provider,
        title,
        description,
        metadata,
        detected_at as "detectedAt",
        acknowledged_at as "acknowledgedAt",
        resolved_at as "resolvedAt"
      from operations_alerts
      where ${where}
      order by detected_at desc
      limit ${limit}
      offset ${offset}
    `);
    const resolvedCutoff = timestampParam(
      new Date(Date.now() - 24 * 60 * 60 * 1000),
    );
    const [summary] = await db.execute<Record<string, unknown>>(sql`
      select
        coalesce(sum(case when status = 'open' and severity = 'critical' then 1 else 0 end), 0)::int as "openCriticalAlerts",
        coalesce(sum(case when status = 'open' and severity = 'warning' then 1 else 0 end), 0)::int as "openWarningAlerts",
        coalesce(sum(case when status = 'acknowledged' then 1 else 0 end), 0)::int as "acknowledgedAlerts",
        coalesce(sum(case when status = 'resolved' and resolved_at >= ${resolvedCutoff}::timestamptz then 1 else 0 end), 0)::int as "resolvedAlertsLast24h"
      from operations_alerts
    `);
    const total = numberFrom(countRow?.total);
    return {
      items: rows.map(serializeAlert),
      summary: {
        openCriticalAlerts: numberFrom(summary?.openCriticalAlerts),
        openWarningAlerts: numberFrom(summary?.openWarningAlerts),
        acknowledgedAlerts: numberFrom(summary?.acknowledgedAlerts),
        resolvedAlertsLast24h: numberFrom(summary?.resolvedAlertsLast24h),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: total > 0 ? Math.ceil(total / limit) : 0,
      },
    };
  }

  async updateAlert(
    alertId: string,
    input: { action: "acknowledge" | "resolve"; platformAdminId: string },
  ) {
    const db = getDb();
    const [alert] = await db
      .select()
      .from(operationsAlerts)
      .where(eq(operationsAlerts.id, alertId))
      .limit(1);
    if (!alert) throw new NotFoundException("Operations alert not found");
    const now = new Date();
    await db
      .update(operationsAlerts)
      .set(
        input.action === "acknowledge"
          ? {
              status: "acknowledged",
              acknowledgedAt: now,
              acknowledgedByPlatformAdminId: input.platformAdminId,
              updatedAt: now,
            }
          : { status: "resolved", resolvedAt: now, updatedAt: now },
      )
      .where(eq(operationsAlerts.id, alertId));
    return { ok: true };
  }

  async getOverview() {
    const [alerts, runs] = await Promise.all([
      this.listAlerts({ limit: 1 }),
      this.listAutomationRuns({ limit: 1 }),
    ]);
    return {
      criticalAlerts: alerts.summary.openCriticalAlerts,
      failedAutomationRunsLast24h: runs.summary.failedRunsLast24h,
    };
  }

  private async openAlert(input: AlertCondition) {
    const existing = await this.findUnresolved(input.alertKey);
    if (existing) return existing;
    const [alert] = await getDb()
      .insert(operationsAlerts)
      .values({
        alertKey: input.alertKey,
        severity: input.severity,
        status: "open",
        provider: input.provider ?? null,
        title: input.title,
        description: input.description,
        metadata: input.metadata ?? null,
        detectedAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return alert;
  }

  private async resolveAlerts(alertKeys: string[]) {
    const now = new Date();
    for (const alertKey of alertKeys) {
      const existing = await this.findUnresolved(alertKey);
      if (!existing) continue;
      await getDb()
        .update(operationsAlerts)
        .set({ status: "resolved", resolvedAt: now, updatedAt: now })
        .where(eq(operationsAlerts.id, existing.id));
    }
  }

  private async findUnresolved(alertKey: string) {
    const [alert] = await getDb()
      .select()
      .from(operationsAlerts)
      .where(
        and(
          eq(operationsAlerts.alertKey, alertKey),
          or(
            eq(operationsAlerts.status, "open"),
            eq(operationsAlerts.status, "acknowledged"),
          ),
        ),
      )
      .limit(1);
    return alert ?? null;
  }
}

function buildAutomationRunWhere(query: {
  jobKey?: string;
  status?: string;
  from?: string;
  to?: string;
}) {
  const filters: SQL[] = [];
  if (query.jobKey?.trim()) filters.push(sql`job_key = ${query.jobKey.trim()}`);
  if (
    query.status === "running" ||
    query.status === "completed" ||
    query.status === "failed"
  ) {
    filters.push(sql`status = ${query.status}`);
  }
  const from = parseTimestampParam(query.from);
  if (from) filters.push(sql`started_at >= ${from}::timestamptz`);
  const to = parseTimestampParam(query.to);
  if (to) filters.push(sql`started_at <= ${to}::timestamptz`);
  return filters.length > 0 ? sql.join(filters, sql` and `) : sql`true`;
}

function buildAlertWhere(query: {
  status?: OperationsAlertStatus | "all";
  severity?: OperationsAlertSeverity | "all";
  provider?: string;
}) {
  const filters: SQL[] = [];
  if (
    query.status === "open" ||
    query.status === "acknowledged" ||
    query.status === "resolved"
  ) {
    filters.push(sql`status = ${query.status}`);
  }
  if (
    query.severity === "info" ||
    query.severity === "warning" ||
    query.severity === "critical"
  ) {
    filters.push(sql`severity = ${query.severity}`);
  }
  if (query.provider?.trim()) filters.push(sql`provider = ${query.provider.trim()}`);
  return filters.length > 0 ? sql.join(filters, sql` and `) : sql`true`;
}

function serializeAutomationRun(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    jobKey: String(row.jobKey),
    status: row.status as "running" | "completed" | "failed",
    processedCount: numberFrom(row.processedCount),
    successCount: numberFrom(row.successCount),
    failureCount: numberFrom(row.failureCount),
    errorSummary: row.errorSummary ?? null,
    startedAt: toIso(row.startedAt) ?? "",
    finishedAt: toIso(row.finishedAt),
  };
}

function serializeAlert(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    alertKey: String(row.alertKey),
    severity: row.severity as OperationsAlertSeverity,
    status: row.status as OperationsAlertStatus,
    provider: typeof row.provider === "string" ? row.provider : null,
    title: String(row.title),
    description: String(row.description),
    metadata: row.metadata ?? null,
    detectedAt: toIso(row.detectedAt) ?? "",
    acknowledgedAt: toIso(row.acknowledgedAt),
    resolvedAt: toIso(row.resolvedAt),
  };
}

function parsePositiveInt(value: number | string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parseTimestampParam(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function numberFrom(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function percentage(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function toIso(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function timestampParam(date: Date) {
  return date.toISOString();
}
