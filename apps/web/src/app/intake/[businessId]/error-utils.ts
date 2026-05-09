export function asMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value;
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string" && item.trim().length > 0);
    return typeof first === "string" ? first : null;
  }
  return null;
}

export function normalizeApiError(data: unknown, fallback: string): string {
  const body = (data ?? {}) as { message?: unknown; error?: unknown };
  return asMessage(body.message) ?? asMessage(body.error) ?? fallback;
}
