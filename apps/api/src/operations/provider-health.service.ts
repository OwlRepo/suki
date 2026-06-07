import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { getDb, providerHealthSnapshots } from "@tyvera/database";
import { sql, type SQL } from "drizzle-orm";
import {
  getSemaphoreCriticalThreshold,
  getSemaphoreWarningThreshold,
  OPERATIONS_PROVIDER_HEALTH_CRON,
} from "./operations.constants";
import { OperationsAlertService } from "./operations-alert.service";

type ProviderStatus = "healthy" | "degraded" | "down" | "unknown";
type DbWithExecute = {
  execute: <T = Record<string, unknown>>(query: SQL) => Promise<T[]>;
};

@Injectable()
export class ProviderHealthService {
  constructor(private readonly alerts: OperationsAlertService) {}

  @Cron(OPERATIONS_PROVIDER_HEALTH_CRON)
  async pollSemaphoreHealth() {
    const apiKey = process.env.SEMAPHORE_API_KEY?.trim();
    const warningThreshold = getSemaphoreWarningThreshold();
    const criticalThreshold = getSemaphoreCriticalThreshold();
    if (!apiKey) {
      await this.insertSnapshot({
        provider: "semaphore",
        status: "unknown",
        creditBalance: null,
        metrics: { reason: "missing_api_key" },
      });
      return;
    }

    try {
      const res = await fetch(
        `https://api.semaphore.co/api/v4/account?apikey=${encodeURIComponent(apiKey)}`,
      );
      if (!res.ok) {
        await this.insertSnapshot({
          provider: "semaphore",
          status: "down",
          creditBalance: null,
          metrics: { httpStatus: res.status },
        });
        return;
      }
      const payload = (await res.json().catch(() => null)) as Record<
        string,
        unknown
      > | null;
      const balance = extractSemaphoreBalance(payload);
      const status = mapSemaphoreStatus(balance, warningThreshold, criticalThreshold);
      await this.insertSnapshot({
        provider: "semaphore",
        status,
        creditBalance: balance,
        metrics: { warningThreshold, criticalThreshold },
      });
      await this.alerts.evaluateSemaphoreCreditBalance({
        balance,
        warningThreshold,
        criticalThreshold,
      });
    } catch (error) {
      await this.insertSnapshot({
        provider: "semaphore",
        status: "down",
        creditBalance: null,
        metrics: {
          error: error instanceof Error ? error.name : "Error",
        },
      });
    }
  }

  @Cron(OPERATIONS_PROVIDER_HEALTH_CRON)
  async aggregateResendHealth() {
    const db = getDb() as unknown as DbWithExecute;
    const cutoff = timestampParam(new Date(Date.now() - 15 * 60 * 1000));
    const [row] = await db.execute<{
      sent: number;
      delivered: number;
      failed: number;
      bounced: number;
      rejected: number;
      queued: number;
    }>(sql`
      select
        coalesce(sum(case when status = 'sent' then 1 else 0 end), 0)::int as sent,
        coalesce(sum(case when delivery_status = 'delivered' then 1 else 0 end), 0)::int as delivered,
        coalesce(sum(case when status = 'failed' or delivery_status = 'failed' then 1 else 0 end), 0)::int as failed,
        coalesce(sum(case when delivery_status = 'bounced' then 1 else 0 end), 0)::int as bounced,
        coalesce(sum(case when delivery_status = 'rejected' then 1 else 0 end), 0)::int as rejected,
        coalesce(sum(case when (
          delivery_status = 'queued'
          or (
            delivery_status is null
            and status = 'queued'
          )
        ) then 1 else 0 end), 0)::int as queued
      from message_events
      where provider = 'resend'
        and created_at >= ${cutoff}::timestamptz
    `);
    const metrics = {
      sent: numberFrom(row?.sent),
      delivered: numberFrom(row?.delivered),
      failed: numberFrom(row?.failed),
      bounced: numberFrom(row?.bounced),
      rejected: numberFrom(row?.rejected),
      queued: numberFrom(row?.queued),
    };
    const total = metrics.sent + metrics.failed + metrics.bounced + metrics.rejected;
    const failureRatePct = percentage(
      metrics.failed + metrics.bounced + metrics.rejected,
      total,
    );
    await this.insertSnapshot({
      provider: "resend",
      status: failureRatePct > 40 ? "down" : failureRatePct > 15 ? "degraded" : "healthy",
      creditBalance: null,
      metrics: { ...metrics, failureRatePct },
    });
    await this.alerts.evaluateEmailFailures({
      failed: metrics.failed + metrics.bounced + metrics.rejected,
      total,
    });
  }

  async getProviderHealth() {
    const db = getDb() as unknown as DbWithExecute;
    const historyCutoff = timestampParam(
      new Date(Date.now() - 24 * 60 * 60 * 1000),
    );
    const rows = await db.execute<Record<string, unknown>>(sql`
      select distinct on (provider)
        provider,
        status,
        credit_balance as "creditBalance",
        metrics,
        observed_at as "observedAt"
      from provider_health_snapshots
      order by provider, observed_at desc
    `);
    const history = await db.execute<Record<string, unknown>>(sql`
      select
        provider,
        status,
        credit_balance as "creditBalance",
        metrics,
        observed_at as "observedAt"
      from provider_health_snapshots
      where observed_at >= ${historyCutoff}::timestamptz
      order by observed_at desc
      limit 100
    `);
    return {
      providers: rows.map(serializeProviderSnapshot),
      history: history.map(serializeProviderSnapshot),
    };
  }

  private async insertSnapshot(input: {
    provider: "semaphore" | "resend";
    status: ProviderStatus;
    creditBalance: number | null;
    metrics: Record<string, unknown> | null;
  }) {
    await getDb()
      .insert(providerHealthSnapshots)
      .values({
        provider: input.provider,
        status: input.status,
        creditBalance: input.creditBalance,
        metrics: input.metrics,
        observedAt: new Date(),
      })
      .returning();
  }
}

function extractSemaphoreBalance(payload: Record<string, unknown> | null) {
  const value =
    payload?.credit_balance ??
    payload?.creditBalance ??
    payload?.balance ??
    payload?.credits;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.floor(numberValue) : null;
}

function mapSemaphoreStatus(
  balance: number | null,
  warningThreshold: number,
  criticalThreshold: number,
): ProviderStatus {
  if (balance === null) return "unknown";
  if (balance < warningThreshold && balance >= criticalThreshold) return "degraded";
  if (balance < criticalThreshold) return "degraded";
  return "healthy";
}

function serializeProviderSnapshot(row: Record<string, unknown>) {
  return {
    provider: String(row.provider),
    status: row.status as ProviderStatus,
    creditBalance:
      row.creditBalance === null || row.creditBalance === undefined
        ? null
        : numberFrom(row.creditBalance),
    metrics: row.metrics ?? null,
    observedAt: toIso(row.observedAt) ?? "",
  };
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
