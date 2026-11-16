import { describe, expect, it } from "vitest";
import {
  BILLING_ADDON_CATALOG,
  BILLING_INTERVALS,
  BILLING_PLAN_CATALOG,
  MANUAL_SUBSCRIPTION_CATALOG,
  getPlanCatalogEntry,
  resolveAddonSku,
  resolveManualBillingSku,
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

  it("uses the approved USD pricing and launch limits", () => {
    expect(getPlanCatalogEntry("free")).toMatchObject({
      monthlyPriceUsd: 0,
      annualPriceUsd: null,
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
      monthlyPriceUsd: 19,
      annualPriceUsd: 190,
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
      monthlyPriceUsd: 45,
      annualPriceUsd: 450,
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
      monthlyPriceUsd: 99,
      annualPriceUsd: 990,
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
      priceUsd: 11,
      variantEnvKey: "LEMONSQUEEZY_VARIANT_ONLINE_BOOKING_TOPUP_25",
    });

    expect(resolveAddonSku("sms-segment-topup-100")).toMatchObject({
      purchaseKind: "sms_segment_topup",
      units: 100,
      priceUsd: 9,
      variantEnvKey: "LEMONSQUEEZY_VARIANT_SMS_SEGMENT_TOPUP_100",
    });
  });

  it("keeps canonical validation-stage monthly manual subscription prices", () => {
    expect(MANUAL_SUBSCRIPTION_CATALOG.map((item) => item.sku)).toEqual([
      "starter-monthly",
      "growth-monthly",
      "pro-monthly",
    ]);
    expect(resolveManualBillingSku("starter-monthly")).toMatchObject({
      purchaseKind: "subscription",
      planType: "starter",
      billingInterval: "monthly",
      pricePhp: 999,
    });
    expect(resolveManualBillingSku("growth-monthly")).toMatchObject({
      pricePhp: 2_499,
    });
    expect(resolveManualBillingSku("pro-monthly")).toMatchObject({
      pricePhp: 5_999,
    });
  });

  it("regression: keeps manual add-on billing in PHP while self-serve add-ons are USD", () => {
    expect(resolveManualBillingSku("sms-segment-topup-25")).toMatchObject({
      purchaseKind: "sms_segment_topup",
      units: 25,
      pricePhp: 599,
      variantEnvKey: "LEMONSQUEEZY_VARIANT_SMS_SEGMENT_TOPUP_25",
    });
    expect(resolveManualBillingSku("online-booking-topup-250")).toMatchObject({
      pricePhp: 5_499,
    });
    expect(resolveAddonSku("sms-segment-topup-25")).toMatchObject({ priceUsd: 3 });
    expect(resolveAddonSku("sms-segment-topup-25")).not.toHaveProperty("pricePhp");
  });

  it("happy: prices every self-serve add-on SKU in USD", () => {
    expect(
      Object.fromEntries(BILLING_ADDON_CATALOG.map((item) => [item.sku, item.priceUsd])),
    ).toEqual({
      "online-booking-topup-10": 5,
      "online-booking-topup-25": 11,
      "online-booking-topup-50": 20,
      "online-booking-topup-100": 38,
      "online-booking-topup-250": 89,
      "sms-segment-topup-25": 3,
      "sms-segment-topup-50": 5,
      "sms-segment-topup-100": 9,
      "sms-segment-topup-250": 19,
    });
  });
});
