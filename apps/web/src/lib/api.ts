import {
  getDevApiUrl,
  getDevMockFailure,
  getDevMockLatencyMs,
} from "./dev-store";
import { getApiBaseUrl as getDefaultApiBaseUrl } from "./api-base";

function getApiBaseUrl(): string {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
    const override = getDevApiUrl();
    if (override && override.trim()) return override.trim();
  }
  return getDefaultApiBaseUrl();
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
    if (getDevMockFailure()) {
      throw new Error("[Dev] Mock API failure");
    }
    const latencyMs = getDevMockLatencyMs();
    if (latencyMs > 0) {
      await new Promise((r) => setTimeout(r, latencyMs));
    }
  }

  const { token, ...init } = options;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    const err = new Error((body as { message?: string }).message || "Request failed");
    (err as Error & { status?: number; responseBody?: unknown }).status = res.status;
    (err as Error & { status?: number; responseBody?: unknown }).responseBody = body;
    throw err;
  }
  return res.json();
}

export function isApiConflictWithDuplicate(err: unknown): err is Error & { responseBody: { duplicateWarning: true; matches: Array<{ id: string; name: string; reason: string }> } } {
  if (!(err instanceof Error)) return false;
  const e = err as Error & { status?: number; responseBody?: unknown };
  return e.status === 409 && (e.responseBody as { duplicateWarning?: boolean })?.duplicateWarning === true;
}
