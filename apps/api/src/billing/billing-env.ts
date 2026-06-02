function isConfigured(name: string): boolean {
  const value = process.env[name]?.trim();
  return !!value && !value.toLowerCase().includes("placeholder");
}

function assertConfigured(name: string): void {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required configuration: ${name}`);
  }
  if (value.toLowerCase().includes("placeholder")) {
    throw new Error(`Configuration ${name} contains a placeholder value.`);
  }
}

export function validateRuntimeConfiguration(): void {
  const selfServeEnabled = process.env.FF_self_serve_billing_enabled === "true";

  if (selfServeEnabled) {
    assertConfigured("LEMONSQUEEZY_API_KEY");
    assertConfigured("LEMONSQUEEZY_STORE_ID");
    assertConfigured("LEMONSQUEEZY_WEBHOOK_SECRET");
  }

  const otpEnabled = process.env.FF_self_serve_billing_enabled === "true";
  if (otpEnabled && process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim()) {
    assertConfigured("TWILIO_VERIFY_SERVICE_SID");
  }

  if (isConfigured("BILLING_GROWTH_VERIFIED_BOOKINGS_PER_MONTH")) {
    const parsed = Number(process.env.BILLING_GROWTH_VERIFIED_BOOKINGS_PER_MONTH);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(
        "Configuration BILLING_GROWTH_VERIFIED_BOOKINGS_PER_MONTH must be a positive integer.",
      );
    }
  }
}
