export function normalizeSmsRecipient(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

export function createSmsLink(mobile: string, body: string): string {
  return `sms:${normalizeSmsRecipient(mobile)}?body=${encodeURIComponent(body)}`;
}
