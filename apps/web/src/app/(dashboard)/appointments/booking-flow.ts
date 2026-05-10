export type VerifyMode = "otp" | "override";

export function defaultVerifyMode(input: { mobile?: string | null }): VerifyMode {
  return input.mobile?.trim() ? "otp" : "override";
}

export function canSubmitVerify(input: {
  mode: VerifyMode;
  otpCode?: string;
  pin?: string;
  reason?: string;
}): boolean {
  if (input.mode === "otp") return Boolean(input.otpCode?.trim());
  return Boolean(input.pin?.trim() && input.reason?.trim());
}

export function normalizeBookingError(err: unknown): string {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "Request failed";
  const lower = message.toLowerCase();
  if (lower.includes("conflict")) {
    return "That time slot was just taken. Please choose another time.";
  }
  if (lower.includes("not configured") && lower.includes("pin")) {
    return "Manager override is not set up yet. Ask the owner to set it in Settings.";
  }
  if (lower.includes("invalid manager pin")) {
    return "Invalid manager PIN. Please try again.";
  }
  if (lower.includes("too many failed pin attempts")) {
    return "Too many failed PIN attempts. Please wait and try again later.";
  }
  return message;
}

export function shouldShowManagerPinSetupOnAppointments(): boolean {
  return false;
}
