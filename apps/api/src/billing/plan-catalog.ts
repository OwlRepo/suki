import type {
  BillingAddonSku,
  BillingInterval,
  BillingPurchaseKind,
  ManualBillingSku,
  ManualSubscriptionSku,
  PlanType,
} from "@tyvera/types";

export interface PlanCatalogEntry {
  planType: PlanType;
  displayName: string;
  monthlyPriceUsd: number;
  annualPriceUsd: number | null;
  mostPopular?: boolean;
  limits: {
    branches: number;
    staffAccounts: number;
    customerRecords: number;
    staffCreatedAppointmentsPerMonth: number | null;
    verifiedOnlineBookingsPerMonth: number;
    emailMessagesPerMonth: number;
    aiRequestsPerMonth: number;
  };
  modules: string[];
}

export interface BillingAddonCatalogEntry {
  sku: BillingAddonSku;
  purchaseKind: Exclude<BillingPurchaseKind, "subscription">;
  units: number;
  priceUsd: number;
  variantEnvKey: string;
}

// Manual (platform-admin) add-on billing is invoiced in PHP; self-serve add-ons are charged in USD by Lemon Squeezy.
export type ManualAddonCatalogEntry = Omit<BillingAddonCatalogEntry, "priceUsd"> & {
  pricePhp: number;
};

export interface ManualSubscriptionCatalogEntry {
  sku: ManualSubscriptionSku;
  purchaseKind: "subscription";
  planType: Exclude<PlanType, "free">;
  billingInterval: "monthly";
  pricePhp: number;
}

export const BILLING_INTERVALS = ["monthly", "annual"] as const satisfies BillingInterval[];

const GROWTH_BOOKING_ALLOWANCE_DEFAULT = 80;

function readGrowthBookingAllowance(): number {
  const raw = process.env.BILLING_GROWTH_VERIFIED_BOOKINGS_PER_MONTH?.trim();
  const parsed = Number(raw);
  if (!raw || !Number.isFinite(parsed) || parsed <= 0) {
    return GROWTH_BOOKING_ALLOWANCE_DEFAULT;
  }
  return Math.floor(parsed);
}

export const BILLING_PLAN_CATALOG: PlanCatalogEntry[] = [
  {
    planType: "free",
    displayName: "Free",
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
    modules: [
      "customers",
      "appointments",
      "booking_page",
      "intake_qr",
      "booking_slot_holds",
      "basic_insights",
    ],
  },
  {
    planType: "starter",
    displayName: "Starter",
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
    modules: [
      "customers",
      "appointments",
      "booking_page",
      "intake_qr",
      "booking_slot_holds",
      "basic_insights",
      "imports",
      "auto_appointment_messaging",
      "auto_missed_recovery",
      "auto_post_visit",
    ],
  },
  {
    planType: "growth",
    displayName: "Growth",
    monthlyPriceUsd: 45,
    annualPriceUsd: 450,
    mostPopular: true,
    limits: {
      branches: 3,
      staffAccounts: 10,
      customerRecords: 5_000,
      staffCreatedAppointmentsPerMonth: null,
      verifiedOnlineBookingsPerMonth: readGrowthBookingAllowance(),
      emailMessagesPerMonth: 5_000,
      aiRequestsPerMonth: 100,
    },
    modules: [
      "customers",
      "appointments",
      "booking_page",
      "intake_qr",
      "booking_slot_holds",
      "basic_insights",
      "imports",
      "auto_appointment_messaging",
      "auto_missed_recovery",
      "auto_post_visit",
      "auto_winback",
      "ai_messaging",
      "basic_segmentation",
      "month_to_month_comparison",
    ],
  },
  {
    planType: "pro",
    displayName: "Pro",
    monthlyPriceUsd: 99,
    annualPriceUsd: 990,
    limits: {
      branches: 10,
      staffAccounts: 30,
      customerRecords: 25_000,
      staffCreatedAppointmentsPerMonth: null,
      verifiedOnlineBookingsPerMonth: 250,
      emailMessagesPerMonth: 15_000,
      aiRequestsPerMonth: 500,
    },
    modules: [
      "customers",
      "appointments",
      "booking_page",
      "intake_qr",
      "booking_slot_holds",
      "basic_insights",
      "imports",
      "auto_appointment_messaging",
      "auto_missed_recovery",
      "auto_post_visit",
      "auto_winback",
      "ai_messaging",
      "basic_segmentation",
      "advanced_segmentation",
      "month_to_month_comparison",
      "multi_branch",
      "branch_insights",
      "data_export",
    ],
  },
];

export const BILLING_ADDON_CATALOG: BillingAddonCatalogEntry[] = [
  {
    sku: "online-booking-topup-10",
    purchaseKind: "online_booking_topup",
    units: 10,
    priceUsd: 5,
    variantEnvKey: "LEMONSQUEEZY_VARIANT_ONLINE_BOOKING_TOPUP_10",
  },
  {
    sku: "online-booking-topup-25",
    purchaseKind: "online_booking_topup",
    units: 25,
    priceUsd: 11,
    variantEnvKey: "LEMONSQUEEZY_VARIANT_ONLINE_BOOKING_TOPUP_25",
  },
  {
    sku: "online-booking-topup-50",
    purchaseKind: "online_booking_topup",
    units: 50,
    priceUsd: 20,
    variantEnvKey: "LEMONSQUEEZY_VARIANT_ONLINE_BOOKING_TOPUP_50",
  },
  {
    sku: "online-booking-topup-100",
    purchaseKind: "online_booking_topup",
    units: 100,
    priceUsd: 38,
    variantEnvKey: "LEMONSQUEEZY_VARIANT_ONLINE_BOOKING_TOPUP_100",
  },
  {
    sku: "online-booking-topup-250",
    purchaseKind: "online_booking_topup",
    units: 250,
    priceUsd: 89,
    variantEnvKey: "LEMONSQUEEZY_VARIANT_ONLINE_BOOKING_TOPUP_250",
  },
  {
    sku: "sms-segment-topup-25",
    purchaseKind: "sms_segment_topup",
    units: 25,
    priceUsd: 3,
    variantEnvKey: "LEMONSQUEEZY_VARIANT_SMS_SEGMENT_TOPUP_25",
  },
  {
    sku: "sms-segment-topup-50",
    purchaseKind: "sms_segment_topup",
    units: 50,
    priceUsd: 5,
    variantEnvKey: "LEMONSQUEEZY_VARIANT_SMS_SEGMENT_TOPUP_50",
  },
  {
    sku: "sms-segment-topup-100",
    purchaseKind: "sms_segment_topup",
    units: 100,
    priceUsd: 9,
    variantEnvKey: "LEMONSQUEEZY_VARIANT_SMS_SEGMENT_TOPUP_100",
  },
  {
    sku: "sms-segment-topup-250",
    purchaseKind: "sms_segment_topup",
    units: 250,
    priceUsd: 19,
    variantEnvKey: "LEMONSQUEEZY_VARIANT_SMS_SEGMENT_TOPUP_250",
  },
];

export const MANUAL_SUBSCRIPTION_CATALOG: ManualSubscriptionCatalogEntry[] = [
  {
    sku: "starter-monthly",
    purchaseKind: "subscription",
    planType: "starter",
    billingInterval: "monthly",
    pricePhp: 999,
  },
  {
    sku: "growth-monthly",
    purchaseKind: "subscription",
    planType: "growth",
    billingInterval: "monthly",
    pricePhp: 2_499,
  },
  {
    sku: "pro-monthly",
    purchaseKind: "subscription",
    planType: "pro",
    billingInterval: "monthly",
    pricePhp: 5_999,
  },
];

const MANUAL_ADDON_PRICE_PHP: Record<BillingAddonSku, number> = {
  "online-booking-topup-10": 299,
  "online-booking-topup-25": 699,
  "online-booking-topup-50": 1_299,
  "online-booking-topup-100": 2_399,
  "online-booking-topup-250": 5_499,
  "sms-segment-topup-25": 599,
  "sms-segment-topup-50": 1_099,
  "sms-segment-topup-100": 2_099,
  "sms-segment-topup-250": 4_999,
};

export const MANUAL_ADDON_CATALOG: ManualAddonCatalogEntry[] = BILLING_ADDON_CATALOG.map(
  ({ priceUsd: _priceUsd, ...entry }) => ({
    ...entry,
    pricePhp: MANUAL_ADDON_PRICE_PHP[entry.sku],
  }),
);

export const MANUAL_BILLING_CATALOG = [
  ...MANUAL_SUBSCRIPTION_CATALOG,
  ...MANUAL_ADDON_CATALOG,
];

export function getPlanCatalogEntry(planType: PlanType): PlanCatalogEntry {
  const entry = BILLING_PLAN_CATALOG.find((plan) => plan.planType === planType);
  if (!entry) {
    throw new Error(`Unknown plan: ${planType}`);
  }
  return entry;
}

export function resolveSubscriptionVariantEnvKey(
  planType: Exclude<PlanType, "free">,
  billingInterval: BillingInterval,
): string {
  return `LEMONSQUEEZY_VARIANT_${planType.toUpperCase()}_${billingInterval.toUpperCase()}`;
}

export function resolveAddonSku(sku: BillingAddonCatalogEntry["sku"]): BillingAddonCatalogEntry {
  const entry = BILLING_ADDON_CATALOG.find((item) => item.sku === sku);
  if (!entry) {
    throw new Error(`Unknown add-on sku: ${sku}`);
  }
  return entry;
}

export function resolveManualBillingSku(
  sku: ManualBillingSku,
): ManualSubscriptionCatalogEntry | ManualAddonCatalogEntry {
  const entry = MANUAL_BILLING_CATALOG.find((item) => item.sku === sku);
  if (!entry) {
    throw new Error(`Unknown manual billing sku: ${sku}`);
  }
  return entry;
}
