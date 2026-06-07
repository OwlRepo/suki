import { config } from "dotenv";

config({ path: ".env", override: false });

const { sql } = await import("drizzle-orm");
const { getDb } = await import("../../../packages/database/src/index");
const { PlatformAdminCommunicationsService } = await import(
  "../src/platform-admin/platform-admin-communications.service"
);
const { ProviderHealthService } = await import(
  "../src/operations/provider-health.service"
);
const { OperationsAlertService } = await import(
  "../src/operations/operations-alert.service"
);

type SafeError = {
  name?: string;
  message?: string;
  code?: string;
  detail?: string;
  hint?: string;
  where?: string;
  cause?: SafeError;
};

function safeError(error: unknown, depth = 0): SafeError {
  if (depth > 4 || !error || typeof error !== "object") {
    return { message: String(error) };
  }

  const value = error as Record<string, unknown>;
  const result: SafeError = {};

  for (const key of ["name", "message", "code", "detail", "hint", "where"] as const) {
    if (typeof value[key] === "string") {
      result[key] = value[key] as string;
    }
  }

  if ("cause" in value && value.cause) {
    result.cause = safeError(value.cause, depth + 1);
  }

  return result;
}

function redactDatabaseUrl(value: string | undefined) {
  if (!value) return "<unset>";
  try {
    const url = new URL(value);
    if (url.password) url.password = "***";
    if (url.username) url.username = url.username ? "***" : "";
    return url.toString();
  } catch {
    return "<configured-but-unparseable>";
  }
}

async function runProbe(name: string, fn: () => Promise<unknown>) {
  process.stdout.write(`\n=== ${name} ===\n`);
  try {
    const result = await fn();
    console.log("PASS");
    console.dir(result, { depth: 8 });
  } catch (error) {
    console.log("FAIL");
    console.dir(safeError(error), { depth: 8 });
    process.exitCode = 1;
  }
}

const db = getDb() as any;
const now = Date.now();
const cutoff10m = new Date(now - 10 * 60 * 1000);
const cutoff15m = new Date(now - 15 * 60 * 1000);
const cutoff24h = new Date(now - 24 * 60 * 60 * 1000);

console.log("Tyvera platform-admin monitoring diagnostics");
console.log("DATABASE_URL:", redactDatabaseUrl(process.env.DATABASE_URL));
console.log("Timestamp probes:", {
  cutoff10m: cutoff10m.toISOString(),
  cutoff15m: cutoff15m.toISOString(),
  cutoff24h: cutoff24h.toISOString(),
});

await runProbe("database identity", async () => {
  return db.execute(sql`
    select
      current_database() as database,
      current_user as "user",
      inet_server_addr() as "serverAddress",
      inet_server_port() as "serverPort"
  `);
});

await runProbe("bound JavaScript Date parameter", async () => {
  return db.execute(sql`
    select
      ${cutoff24h}::timestamptz as "boundDate",
      now() as "databaseNow"
  `);
});

await runProbe("raw communications totals query", async () => {
  return db.execute(sql`
    select
      coalesce(sum(case when me.channel = 'sms' and (
        me.delivery_status = 'queued'
        or (
          me.delivery_status is null
          and me.status = 'queued'
        )
      ) then 1 else 0 end), 0)::int as "smsQueued",
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
    where me.created_at >= ${cutoff24h}
  `);
});

await runProbe("raw provider-health history query", async () => {
  return db.execute(sql`
    select
      provider,
      status,
      credit_balance as "creditBalance",
      metrics,
      observed_at as "observedAt"
    from provider_health_snapshots
    where observed_at >= ${cutoff24h}
    order by observed_at desc
    limit 100
  `);
});

await runProbe("raw automation-runs summary query", async () => {
  return db.execute(sql`
    select
      max(case when job_key = 'appointment_reminders' then started_at end) as "lastAppointmentReminderRun",
      max(case when job_key = 'inactivity_winback' then started_at end) as "lastInactivityWinbackRun",
      max(case when job_key = 'semaphore_reconciliation' then started_at end) as "lastSemaphoreReconciliationRun",
      coalesce(sum(case when status = 'failed' and started_at >= ${cutoff24h} then 1 else 0 end), 0)::int as "failedRunsLast24h"
    from automation_job_runs
  `);
});

await runProbe("raw alerts summary query", async () => {
  return db.execute(sql`
    select
      coalesce(sum(case when status = 'open' and severity = 'critical' then 1 else 0 end), 0)::int as "openCriticalAlerts",
      coalesce(sum(case when status = 'open' and severity = 'warning' then 1 else 0 end), 0)::int as "openWarningAlerts",
      coalesce(sum(case when status = 'acknowledged' then 1 else 0 end), 0)::int as "acknowledgedAlerts",
      coalesce(sum(case when status = 'resolved' and resolved_at >= ${cutoff24h} then 1 else 0 end), 0)::int as "resolvedAlertsLast24h"
    from operations_alerts
  `);
});

await runProbe("raw scheduled SMS failures query", async () => {
  return db.execute(sql`
    select
      coalesce(sum(case when status = 'failed' or delivery_status = 'failed' then 1 else 0 end), 0)::int as failed,
      count(*)::int as total
    from message_events
    where channel = 'sms'
      and created_at >= ${cutoff15m}
  `);
});

await runProbe("raw scheduled Resend aggregate query", async () => {
  return db.execute(sql`
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
      and created_at >= ${cutoff15m}
  `);
});

await runProbe("raw scheduled OTP failures query", async () => {
  return db.execute(sql`
    select count(*)::int as failed
    from public_otp_send_events
    where outcome <> 'sent'
      and created_at >= ${cutoff10m}
  `);
});

const alerts = new OperationsAlertService();
const providerHealth = new ProviderHealthService(alerts);
const communications = new PlatformAdminCommunicationsService();

await runProbe("service: communications summary", async () => {
  return communications.getSummary({ range: "24h" });
});

await runProbe("service: provider health", async () => {
  return providerHealth.getProviderHealth();
});

await runProbe("service: automation runs", async () => {
  return alerts.listAutomationRuns({ limit: 25 });
});

await runProbe("service: alerts", async () => {
  return alerts.listAlerts({ limit: 25 });
});

console.log("\nDiagnostics complete.");
if (process.exitCode) {
  console.log("At least one probe failed. Paste the complete FAIL block only.");
} else {
  console.log("All probes passed through Tyvera's real database client and service layer.");
  console.log("If the browser still shows 500 responses, the remaining defect is above the service layer.");
}
