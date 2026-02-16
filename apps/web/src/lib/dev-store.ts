/**
 * Dev-only localStorage keys for API overrides.
 * Only read in development (NODE_ENV=development).
 */
const PREFIX = "suki_dev_";

export const DEV_KEYS = {
  API_URL: `${PREFIX}api_url`,
  MOCK_LATENCY_MS: `${PREFIX}mock_latency_ms`,
  MOCK_FAILURE: `${PREFIX}mock_failure`,
} as const;

function getItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

function setItem(key: string, value: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, value);
}

function removeItem(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}

export function getDevApiUrl(): string | null {
  return getItem(DEV_KEYS.API_URL);
}

export function setDevApiUrl(url: string): void {
  setItem(DEV_KEYS.API_URL, url);
}

export function getDevMockLatencyMs(): number {
  const v = getItem(DEV_KEYS.MOCK_LATENCY_MS);
  const n = v ? parseInt(v, 10) : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function setDevMockLatencyMs(ms: number): void {
  setItem(DEV_KEYS.MOCK_LATENCY_MS, String(Math.max(0, ms)));
}

export function getDevMockFailure(): boolean {
  return getItem(DEV_KEYS.MOCK_FAILURE) === "true";
}

export function setDevMockFailure(enabled: boolean): void {
  setItem(DEV_KEYS.MOCK_FAILURE, enabled ? "true" : "false");
}

/** Clear all dev overrides. */
export function clearDevOverrides(): void {
  Object.values(DEV_KEYS).forEach(removeItem);
}
