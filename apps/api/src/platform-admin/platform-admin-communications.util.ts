export function maskRecipient(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  if (trimmed.includes("@")) {
    const [local, domain] = trimmed.split("@");
    if (!local || !domain) return "***";
    return `${local.slice(0, 1)}***@${domain}`;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 4) {
    return `*******${digits.slice(-4)}`;
  }

  return "***";
}

export function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}
