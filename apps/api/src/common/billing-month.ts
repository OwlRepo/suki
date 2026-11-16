// Billing months follow Asia/Manila local time (UTC+08:00, no DST), so the month flips at Manila midnight.
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

export function billingMonthKey(date: Date = new Date()): string {
  const manila = new Date(date.getTime() + MANILA_OFFSET_MS);
  return `${manila.getUTCFullYear()}-${String(manila.getUTCMonth() + 1).padStart(2, "0")}`;
}
