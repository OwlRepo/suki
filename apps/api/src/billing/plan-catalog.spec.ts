import { describe, expect, it } from "vitest";
import {
  BILLING_ADDON_CATALOG,
  BILLING_INTERVALS,
  BILLING_PLAN_CATALOG,
  getPlanCatalogEntry,
  resolveAddonSku,
  resolveSubscriptionVariantEnvKey,
} from "./plan-catalog";

describe("plan-catalog", () => {
  it("includes the approved free, starter, growth, and pro plans", () => {
    expect(BILLING_PLAN_CATALOG.map((plan) => plan.planType)).toEqual([
      "free",
      "starter",
      "growth",
      "pro",
    ]);
  });

  it("uses the approved PHP pricing and launch limits", () => {
    expect(getPlanCatalogEntry("free")).toMatchObject({
      monthlyPricePhp: 0,
      annualPricePhp: null,
      limits: {
        branches: 1,
        staffAccounts: 1,
        customerRecords: 100,
        staffCreatedAppointmentsPerMonth: 50,
        verifiedOnlineBookingsPerMonth: 5,
        emailMessagesPerMonth: 100,
        aiRequestsPerMonth: 0,
      },
    });

    expect(getPlanCatalogEntry("starter")).toMatchObject({
      monthlyPricePhp: 999,
      annualPricePhp: 9_990,
      limits: {
        branches: 1,
        staffAccounts: 3,
        customerRecords: 1_000,
        staffCreatedAppointmentsPerMonth: null,
        verifiedOnlineBookingsPerMonth: 30,
        emailMessagesPerMonth: 1_500,
        aiRequestsPerMonth: 0,
      },
    });

    expect(getPlanCatalogEntry("growth")).toMatchObject({
      monthlyPricePhp: 2_499,
      annualPricePhp: 24_990,
      mostPopular: true,
      limits: {
        branches: 3,
        staffAccounts: 10,
        customerRecords: 5_000,
        verifiedOnlineBookingsPerMonth: 80,
        emailMessagesPerMonth: 5_000,
        aiRequestsPerMonth: 100,
      },
    });

    expect(getPlanCatalogEntry("pro")).toMatchObject({
      monthlyPricePhp: 5_999,
      annualPricePhp: 59_990,
      limits: {
        branches: 10,
        staffAccounts: 30,
        customerRecords: 25_000,
        verifiedOnlineBookingsPerMonth: 250,
        emailMessagesPerMonth: 15_000,
        aiRequestsPerMonth: 500,
      },
    });
  });

  it("defines only monthly and annual billing intervals", () => {
    expect(BILLING_INTERVALS).toEqual(["monthly", "annual"]);
  });

  it("resolves allowlisted subscription variant env keys deterministically", () => {
    expect(resolveSubscriptionVariantEnvKey("starter", "monthly")).toBe(
      "LEMONSQUEEZY_VARIANT_STARTER_MONTHLY",
    );
    expect(resolveSubscriptionVariantEnvKey("growth", "annual")).toBe(
      "LEMONSQUEEZY_VARIANT_GROWTH_ANNUAL",
    );
    expect(resolveSubscriptionVariantEnvKey("pro", "monthly")).toBe(
      "LEMONSQUEEZY_VARIANT_PRO_MONTHLY",
    );
  });

  it("defines the approved OTP and SMS add-on SKUs", () => {
    expect(BILLING_ADDON_CATALOG.map((item) => item.sku)).toEqual([
      "online-booking-topup-10",
      "online-booking-topup-25",
      "online-booking-topup-50",
      "online-booking-topup-100",
      "online-booking-topup-250",
      "sms-segment-topup-25",
      "sms-segment-topup-50",
      "sms-segment-topup-100",
      "sms-segment-topup-250",
    ]);

    expect(resolveAddonSku("online-booking-topup-25")).toMatchObject({
      purchaseKind: "online_booking_topup",
      units: 25,
      pricePhp: 699,
      variantEnvKey: "LEMONSQUEEZY_VARIANT_ONLINE_BOOKING_TOPUP_25",
    });

    expect(resolveAddonSku("sms-segment-topup-100")).toMatchObject({
      purchaseKind: "sms_segment_topup",
      units: 100,
      pricePhp: 2_099,
      variantEnvKey: "LEMONSQUEEZY_VARIANT_SMS_SEGMENT_TOPUP_100",
    });
  });
});
