export const OPERATIONS_PROVIDER_HEALTH_CRON = "*/5 * * * *";

export const EXPECTED_JOB_INTERVALS = {
  appointment_reminders: {
    expectedEveryMinutes: 15,
    graceMinutes: 10,
  },
  inactivity_winback: {
    expectedEveryMinutes: 24 * 60,
    graceMinutes: 60,
  },
  semaphore_reconciliation: {
    expectedEveryMinutes: 5,
    graceMinutes: 5,
  },
} as const;

export type ExpectedJobKey = keyof typeof EXPECTED_JOB_INTERVALS;

export function getSemaphoreWarningThreshold() {
  return parseThreshold(process.env.SEMAPHORE_CREDIT_WARNING_THRESHOLD, 500);
}

export function getSemaphoreCriticalThreshold() {
  return parseThreshold(process.env.SEMAPHORE_CREDIT_CRITICAL_THRESHOLD, 200);
}

function parseThreshold(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
