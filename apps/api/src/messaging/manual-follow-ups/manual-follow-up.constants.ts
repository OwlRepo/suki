import type { AutomationKey } from "@tyvera/types";

export const MANUAL_FOLLOW_UP_AUTOMATION_KEYS = [
  "appointment_confirmation",
  "appointment_reminder_24h",
  "appointment_reminder_72h",
  "missed_recovery",
] as const satisfies readonly AutomationKey[];

export const MANUAL_FOLLOW_UP_AUTOMATION_KEY_SET = new Set<string>(
  MANUAL_FOLLOW_UP_AUTOMATION_KEYS,
);

export const SEMAPHORE_RECONCILIATION_CRON =
  process.env.SEMAPHORE_RECONCILIATION_CRON?.trim() || "*/5 * * * *";

export const MANUAL_FOLLOW_UP_DIGEST_CRON =
  process.env.MANUAL_FOLLOW_UP_DIGEST_CRON?.trim() || "*/15 * * * *";

export const SEMAPHORE_RECONCILIATION_BATCH_SIZE = 100;
export const SEMAPHORE_RECONCILIATION_LOOKBACK_HOURS = 72;
