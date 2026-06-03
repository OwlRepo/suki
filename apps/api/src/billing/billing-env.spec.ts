import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validateRuntimeConfiguration } from "./billing-env";

describe("validateRuntimeConfiguration", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    delete process.env.FF_self_serve_billing_enabled;
    delete process.env.LEMONSQUEEZY_API_KEY;
    delete process.env.LEMONSQUEEZY_STORE_ID;
    delete process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    delete process.env.TWILIO_VERIFY_SERVICE_SID;
    delete process.env.BILLING_GROWTH_VERIFIED_BOOKINGS_PER_MONTH;
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("permits missing Lemon Squeezy keys while self-serve billing is disabled", () => {
    expect(() => validateRuntimeConfiguration()).not.toThrow();
  });

  it("fails fast when self-serve billing is enabled but Lemon Squeezy config is missing", () => {
    process.env.FF_self_serve_billing_enabled = "true";

    expect(() => validateRuntimeConfiguration()).toThrow(
      /LEMONSQUEEZY_API_KEY/i,
    );
  });

  it("fails fast on placeholder values", () => {
    process.env.FF_self_serve_billing_enabled = "true";
    process.env.LEMONSQUEEZY_API_KEY = "placeholder_key";
    process.env.LEMONSQUEEZY_STORE_ID = "123";
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET = "whsec_123";

    expect(() => validateRuntimeConfiguration()).toThrow(/placeholder/i);
  });
});
