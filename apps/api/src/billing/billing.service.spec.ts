import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  aiUsageEvents,
  emailCredits,
  creditReconciliationEvents,
  getDb,
  organizations,
  processedWebhookEvents,
  smsAddons,
  smsCredits,
  subscriptions,
  verifiedOnlineBookingAddons,
  verifiedOnlineBookingCredits,
} from "@tyvera/database";
import { BillingService } from "./billing.service";

vi.mock("@tyvera/database", async () => {
  const actual = await vi.importActual<typeof import("@tyvera/database")>("@tyvera/database");
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

type SubscriptionRow = {
  id?: string;
  organizationId: string;
  planType: "free" | "starter" | "growth" | "pro";
  status: "active" | "cancelled" | "past_due" | "trialing" | "paused" | "expired" | "unpaid";
  billingInterval?: "monthly" | "annual" | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  renewsAt?: Date | null;
  endsAt?: Date | null;
  cancelled?: string;
  providerSubscriptionId?: string | null;
  providerCustomerId?: string | null;
  providerOrderId?: string | null;
  providerProductId?: string | null;
  providerVariantId?: string | null;
  providerSubscriptionItemId?: string | null;
  customerPortalUrl?: string | null;
  updatePaymentMethodUrl?: string | null;
  cardBrand?: string | null;
  cardLastFour?: string | null;
  trialEndsAt?: Date | null;
  lastProviderEventId?: string | null;
  planPricePhp?: number;
  scheduledPlanType?: "free" | "starter" | "growth" | "pro" | null;
  scheduledBillingInterval?: "monthly" | "annual" | null;
  scheduledChangeEffectiveAt?: Date | null;
  pendingSyncAction?: string | null;
  pendingSyncStartedAt?: Date | null;
  pendingSyncTargetPlanType?: "free" | "starter" | "growth" | "pro" | null;
  pendingSyncTargetBillingInterval?: "monthly" | "annual" | null;
};

type CreditRow = {
  organizationId: string;
  month: string;
  includedGranted: number;
  addonGranted: number;
  used: number;
  sourcePlan: "free" | "starter" | "growth" | "pro";
};

const getDbMock = vi.mocked(getDb);

function createDbHarness(input?: {
  subscriptions?: SubscriptionRow[];
  verifiedCredits?: CreditRow[];
  smsCredits?: Array<{
    organizationId: string;
    month: string;
    included: number;
    addon: number;
    used: number;
    pausedReason?: string;
  }>;
  emailCredits?: Array<{
    organizationId: string;
    month: string;
    included: number;
    used: number;
  }>;
  aiUsageSummary?: Array<{
    totalRequests: number;
  }>;
  organizations?: Array<Record<string, unknown>>;
  processedEvents?: Array<Record<string, unknown>>;
  reconciliation?: Array<Record<string, unknown>>;
}) {
  const state = {
    subscriptions: [...(input?.subscriptions ?? [])],
    verifiedCredits: [...(input?.verifiedCredits ?? [])],
    smsCredits: [...(input?.smsCredits ?? [])],
    emailCredits: [...(input?.emailCredits ?? [])],
    aiUsageSummary: [...(input?.aiUsageSummary ?? [])],
    organizations: [...(input?.organizations ?? [])],
    processedEvents: [...(input?.processedEvents ?? [])],
    reconciliation: [...(input?.reconciliation ?? [])],
    inserted: {
      subscriptions: [] as Array<Record<string, unknown>>,
      credits: [] as Array<Record<string, unknown>>,
      smsCredits: [] as Array<Record<string, unknown>>,
      emailCredits: [] as Array<Record<string, unknown>>,
      bookingAddons: [] as Array<Record<string, unknown>>,
      smsAddons: [] as Array<Record<string, unknown>>,
      reconciliation: [] as Array<Record<string, unknown>>,
      processedEvents: [] as Array<Record<string, unknown>>,
    },
    updated: {
      subscriptions: [] as Array<Record<string, unknown>>,
      credits: [] as Array<Record<string, unknown>>,
      organizations: [] as Array<Record<string, unknown>>,
      processedEvents: [] as Array<Record<string, unknown>>,
    },
  };

  const select = vi.fn(() => ({
    from: (table: unknown) => ({
      where: () => ({
        orderBy: () => ({
          limit: async () => {
            if (table === subscriptions) return state.subscriptions.slice(0, 1);
            return [];
          },
        }),
        limit: async () => {
          if (table === subscriptions) return state.subscriptions.slice(0, 1);
          if (table === verifiedOnlineBookingCredits) return state.verifiedCredits.slice(0, 1);
          if (table === smsCredits) return state.smsCredits.slice(0, 1);
          if (table === emailCredits) return state.emailCredits.slice(0, 1);
          if (table === aiUsageEvents) return state.aiUsageSummary.slice(0, 1);
          if (table === organizations) return state.organizations.slice(0, 1);
          if (table === processedWebhookEvents) return state.processedEvents.slice(0, 1);
          if (table === creditReconciliationEvents) return state.reconciliation.slice(0, 1);
          return [];
        },
      }),
    }),
  }));

  const insert = vi.fn((table: unknown) => ({
    values: (value: Record<string, unknown>) => {
      const persistValue = () => {
        if (table === subscriptions) {
          state.inserted.subscriptions.push(value);
          state.subscriptions = [value as unknown as SubscriptionRow];
        } else if (table === verifiedOnlineBookingCredits) {
          state.inserted.credits.push(value);
          state.verifiedCredits = [value as unknown as CreditRow];
        } else if (table === smsCredits) {
          state.inserted.smsCredits.push(value);
          state.smsCredits = [value as never];
        } else if (table === emailCredits) {
          state.inserted.emailCredits.push(value);
          state.emailCredits = [value as never];
        } else if (table === verifiedOnlineBookingAddons) {
          state.inserted.bookingAddons.push(value);
        } else if (table === smsAddons) {
          state.inserted.smsAddons.push(value);
        } else if (table === creditReconciliationEvents) {
          state.inserted.reconciliation.push(value);
        } else if (table === processedWebhookEvents) {
          state.inserted.processedEvents.push(value);
          state.processedEvents = [...state.processedEvents, value];
        }
      };

      const builder: any = {
        onConflictDoNothing: () => ({
          returning: async () => {
            const isDuplicate =
              table === processedWebhookEvents &&
              state.processedEvents.some(
                (event) => event.eventId === value.eventId,
              );

            if (isDuplicate) {
              return [];
            }

            persistValue();

            return [
              {
                id: "processed-webhook-event-id",
              },
            ];
          },
        }),
        then: (
          resolve: (value?: unknown) => unknown,
          reject: (reason?: unknown) => unknown,
        ) => Promise.resolve(persistValue()).then(resolve, reject),
      };

      return builder;
    },
  }));

  const update = vi.fn((table: unknown) => ({
    set: (value: Record<string, unknown>) => ({
      where: async () => {
        if (table === subscriptions) {
          state.updated.subscriptions.push(value);
          if (state.subscriptions[0]) {
            state.subscriptions[0] = { ...state.subscriptions[0], ...value };
          }
        } else if (table === verifiedOnlineBookingCredits) {
          state.updated.credits.push(value);
          if (state.verifiedCredits[0]) {
            state.verifiedCredits[0] = { ...state.verifiedCredits[0], ...value } as CreditRow;
          }
        } else if (table === smsCredits) {
          if (state.smsCredits[0]) {
            state.smsCredits[0] = { ...state.smsCredits[0], ...value } as never;
          }
        } else if (table === emailCredits) {
          if (state.emailCredits[0]) {
            state.emailCredits[0] = { ...state.emailCredits[0], ...value } as never;
          }
        } else if (table === organizations) {
          state.updated.organizations.push(value);
          if (state.organizations[0]) {
            state.organizations[0] = { ...state.organizations[0], ...value };
          }
        } else if (table === processedWebhookEvents) {
          state.updated.processedEvents.push(value);
        }
      },
    }),
  }));

  const tx = { select, insert, update };
  const db = {
    select,
    insert,
    update,
    transaction: vi.fn(async (cb: (trx: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  getDbMock.mockReturnValue(db as never);

  return { state };
}

describe("BillingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the centralized plans response with checkout flag", () => {
    const service = new BillingService({} as never);
    const response = service.getPlansResponse({ checkoutEnabled: false });

    expect(response.checkoutEnabled).toBe(false);
    expect(response.plans.map((plan) => plan.planType)).toEqual([
      "free",
      "starter",
      "growth",
      "pro",
    ]);
    expect(response.plans.find((plan) => plan.planType === "growth")).toMatchObject({
      mostPopular: true,
      monthlyPricePhp: 2_499,
    });
  });

  it("builds a free fallback billing status when no subscription exists", async () => {
    createDbHarness();
    const service = new BillingService({} as never);
    vi.spyOn(service, "getSubscription").mockResolvedValue(null as never);

    await expect(service.getBillingStatus("org-1")).resolves.toMatchObject({
      planType: "free",
      billingStatus: "free_active",
      billingInterval: null,
      subscription: null,
    });
  });

  it("uses persisted verified booking ledger balances in billing status", async () => {
    createDbHarness({
      subscriptions: [
        {
          id: "sub-local",
          organizationId: "org-1",
          planType: "starter",
          status: "active",
          billingInterval: "monthly",
          currentPeriodStart: new Date("2026-06-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-06-30T23:59:59.000Z"),
          cancelled: "false",
        },
      ],
      verifiedCredits: [
        {
          organizationId: "org-1",
          month: "2026-06",
          includedGranted: 30,
          addonGranted: 25,
          used: 4,
          sourcePlan: "starter",
        },
      ],
    });
    const service = new BillingService({} as never);

    await expect(service.getBillingStatus("org-1")).resolves.toMatchObject({
      verifiedOnlineBookingCredits: {
        included: 30,
        addon: 25,
        used: 4,
        total: 55,
        remaining: 51,
      },
    });
  });

  it("returns email, ai, and owner warning status fields from current ledgers", async () => {
    createDbHarness({
      subscriptions: [
        {
          id: "sub-local",
          organizationId: "org-1",
          planType: "growth",
          status: "active",
          billingInterval: "monthly",
          currentPeriodStart: new Date("2026-06-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-06-30T23:59:59.000Z"),
          cancelled: "false",
        },
      ],
      emailCredits: [
        {
          organizationId: "org-1",
          month: "2026-06",
          included: 5000,
          used: 1200,
        },
      ],
      aiUsageSummary: [
        {
          totalRequests: 18,
        },
      ],
      reconciliation: [
        {
          organizationId: "org-1",
          creditType: "sms_segment",
          month: "2026-06",
          eventType: "refund_review",
          metadata: {
            sku: "sms-segment-topup-50",
            refundedUnits: 50,
          },
        },
      ],
    });
    const service = new BillingService({} as never);

    await expect(service.getBillingStatus("org-1")).resolves.toMatchObject({
      emailCredits: {
        included: 5000,
        used: 1200,
        total: 5000,
        remaining: 3800,
      },
      aiRequests: {
        included: 100,
        used: 18,
        total: 100,
        remaining: 82,
      },
      ownerWarnings: [
        expect.objectContaining({
          code: "refund_review",
          severity: "warning",
        }),
      ],
    });
  });

  it("surfaces delayed webhook sync warnings from subscription pending sync metadata", async () => {
    createDbHarness({
      subscriptions: [
        {
          id: "sub-local",
          organizationId: "org-1",
          planType: "growth",
          status: "active",
          billingInterval: "monthly",
          currentPeriodStart: new Date("2026-06-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-06-30T23:59:59.000Z"),
          cancelled: "false",
          pendingSyncAction: "change_plan",
          pendingSyncStartedAt: new Date(Date.now() - 180_000),
          pendingSyncTargetPlanType: "pro",
          pendingSyncTargetBillingInterval: "monthly",
        },
      ],
    });
    const service = new BillingService({} as never);

    await expect(service.getBillingStatus("org-1")).resolves.toMatchObject({
      ownerWarnings: [
        expect.objectContaining({
          code: "delayed_webhook_sync",
          severity: "warning",
        }),
      ],
    });
  });

  it("reconciles subscription_created into subscription, org state, and included booking credits", async () => {
    const { state } = createDbHarness({
      organizations: [{ id: "org-1", currentPlan: "free", billingStatus: "free_active" }],
    });
    const service = new BillingService({} as never);

    await service.reconcileWebhookEvent({
      meta: {
        event_name: "subscription_created",
        custom_data: {
          organization_id: "org-1",
          plan_type: "starter",
          billing_interval: "monthly",
        },
      },
      data: {
        id: "sub_123",
        attributes: {
          status: "active",
          order_id: 987,
          customer_id: 654,
          product_id: 321,
          variant_id: 111,
          first_subscription_item: { id: 222 },
          current_period_start: "2026-06-01T00:00:00.000Z",
          current_period_end: "2026-06-30T23:59:59.000Z",
          renews_at: "2026-07-01T00:00:00.000Z",
          ends_at: null,
          trial_ends_at: null,
          cancelled: false,
          card_brand: "visa",
          card_last_four: "4242",
          urls: {
            customer_portal: "https://billing.example/portal",
            update_payment_method: "https://billing.example/payment-method",
          },
        },
      },
    });

    expect(state.inserted.subscriptions[0]).toMatchObject({
      organizationId: "org-1",
      planType: "starter",
      status: "active",
      billingInterval: "monthly",
      provider: "lemonsqueezy",
      providerSubscriptionId: "sub_123",
      providerCustomerId: "654",
      providerOrderId: "987",
      providerProductId: "321",
      providerVariantId: "111",
      providerSubscriptionItemId: "222",
      customerPortalUrl: "https://billing.example/portal",
      updatePaymentMethodUrl: "https://billing.example/payment-method",
      cardBrand: "visa",
      cardLastFour: "4242",
      lastProviderEventId: "sub_123",
      planPricePhp: 999,
    });
    expect(state.updated.organizations[0]).toMatchObject({
      currentPlan: "starter",
      billingStatus: "subscription_active",
    });
    expect(state.inserted.credits[0]).toMatchObject({
      organizationId: "org-1",
      month: "2026-06",
      includedGranted: 30,
      addonGranted: 0,
      used: 0,
      sourcePlan: "starter",
    });
  });

  it("upgrades monthly included booking credits without resetting usage on subscription_updated", async () => {
    const { state } = createDbHarness({
      organizations: [{ id: "org-1", currentPlan: "starter", billingStatus: "subscription_active" }],
      subscriptions: [
        {
          id: "local-sub-1",
          organizationId: "org-1",
          planType: "starter",
          status: "active",
          billingInterval: "monthly",
          currentPeriodStart: new Date("2026-06-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-06-30T23:59:59.000Z"),
          cancelled: "false",
        },
      ],
      verifiedCredits: [
        {
          organizationId: "org-1",
          month: "2026-06",
          includedGranted: 30,
          addonGranted: 0,
          used: 5,
          sourcePlan: "starter",
        },
      ],
    });
    const service = new BillingService({} as never);

    await service.reconcileWebhookEvent({
      meta: {
        event_name: "subscription_updated",
        custom_data: {
          organization_id: "org-1",
          plan_type: "growth",
          billing_interval: "monthly",
        },
      },
      data: {
        id: "sub_123",
        attributes: {
          status: "active",
          current_period_start: "2026-06-01T00:00:00.000Z",
          current_period_end: "2026-06-30T23:59:59.000Z",
          renews_at: "2026-07-01T00:00:00.000Z",
          ends_at: null,
          trial_ends_at: null,
          cancelled: false,
          urls: {},
        },
      },
    });

    expect(state.updated.subscriptions[0]).toMatchObject({
      planType: "growth",
      status: "active",
      billingInterval: "monthly",
      planPricePhp: 2_499,
    });
    expect(state.updated.credits[0]).toMatchObject({
      includedGranted: 80,
      used: 5,
      sourcePlan: "growth",
    });
    expect(state.inserted.reconciliation[0]).toMatchObject({
      organizationId: "org-1",
      creditType: "verified_online_booking",
      month: "2026-06",
      eventType: "subscription_upgrade",
      previousPlan: "starter",
      nextPlan: "growth",
      includedBefore: 30,
      includedAfter: 80,
      usedBefore: 5,
      usedAfter: 5,
      providerEventId: "sub_123",
    });
    expect(state.updated.organizations[0]).toMatchObject({
      currentPlan: "growth",
      billingStatus: "subscription_active",
    });
  });

  it("transitions expired subscriptions to free without deleting data", async () => {
    const { state } = createDbHarness({
      organizations: [{ id: "org-1", currentPlan: "growth", billingStatus: "subscription_active" }],
      subscriptions: [
        {
          id: "local-sub-1",
          organizationId: "org-1",
          planType: "growth",
          status: "active",
          billingInterval: "monthly",
          currentPeriodStart: new Date("2026-06-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-06-30T23:59:59.000Z"),
          cancelled: "false",
        },
      ],
    });
    const service = new BillingService({} as never);

    await service.reconcileWebhookEvent({
      meta: {
        event_name: "subscription_expired",
        custom_data: {
          organization_id: "org-1",
          plan_type: "growth",
          billing_interval: "monthly",
        },
      },
      data: {
        id: "sub_123",
        attributes: {
          status: "expired",
          current_period_start: "2026-06-01T00:00:00.000Z",
          current_period_end: "2026-06-30T23:59:59.000Z",
          ends_at: "2026-06-30T23:59:59.000Z",
          cancelled: true,
          urls: {},
        },
      },
    });

    expect(state.updated.subscriptions[0]).toMatchObject({
      status: "expired",
      cancelled: "true",
      lastProviderEventId: "sub_123",
    });
    expect(state.updated.organizations[0]).toMatchObject({
      currentPlan: "free",
      billingStatus: "subscription_expired",
    });
  });

  it("grants verified booking top-up credits from order_created events", async () => {
    const { state } = createDbHarness({
      organizations: [{ id: "org-1", currentPlan: "starter", billingStatus: "subscription_active" }],
      verifiedCredits: [
        {
          organizationId: "org-1",
          month: "2026-06",
          includedGranted: 30,
          addonGranted: 0,
          used: 4,
          sourcePlan: "starter",
        },
      ],
    });
    const service = new BillingService({} as never);

    await service.reconcileWebhookEvent({
      meta: {
        event_name: "order_created",
        custom_data: {
          organization_id: "org-1",
          purchase_kind: "online_booking_topup",
          sku: "online-booking-topup-25",
          user_id: "user-1",
        },
      },
      data: {
        id: "order_123",
        attributes: {},
      },
    });

    expect(state.updated.credits[0]).toMatchObject({
      addonGranted: 25,
      used: 4,
    });
    expect(state.inserted.bookingAddons[0]).toMatchObject({
      organizationId: "org-1",
      units: 25,
      sku: "online-booking-topup-25",
      providerOrderId: "order_123",
      purchasedByUserId: "user-1",
    });
  });

  it("marks payment failures as past due without downgrading the plan", async () => {
    const { state } = createDbHarness({
      organizations: [{ id: "org-1", currentPlan: "growth", billingStatus: "subscription_active" }],
      subscriptions: [
        {
          id: "local-sub-1",
          organizationId: "org-1",
          planType: "growth",
          status: "active",
          billingInterval: "monthly",
          currentPeriodStart: new Date("2026-06-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-06-30T23:59:59.000Z"),
          cancelled: "false",
          providerSubscriptionId: "sub_123",
        },
      ],
    });
    const service = new BillingService({} as never);

    await service.reconcileWebhookEvent({
      meta: {
        event_name: "subscription_payment_failed",
        custom_data: {
          organization_id: "org-1",
          plan_type: "growth",
          billing_interval: "monthly",
        },
      },
      data: {
        id: "sub_123",
        attributes: {
          status: "past_due",
          current_period_start: "2026-06-01T00:00:00.000Z",
          current_period_end: "2026-06-30T23:59:59.000Z",
          renews_at: "2026-07-01T00:00:00.000Z",
          urls: {},
        },
      },
    });

    expect(state.updated.subscriptions[0]).toMatchObject({
      planType: "growth",
      status: "past_due",
      cancelled: "false",
    });
    expect(state.updated.organizations[0]).toMatchObject({
      currentPlan: "growth",
      billingStatus: "subscription_past_due",
    });
  });

  it("marks subscriptions as paused without downgrading balances", async () => {
    const { state } = createDbHarness({
      organizations: [{ id: "org-1", currentPlan: "growth", billingStatus: "subscription_active" }],
      subscriptions: [
        {
          id: "local-sub-1",
          organizationId: "org-1",
          planType: "growth",
          status: "active",
          billingInterval: "monthly",
          currentPeriodStart: new Date("2026-06-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-06-30T23:59:59.000Z"),
          cancelled: "false",
          providerSubscriptionId: "sub_123",
        },
      ],
    });
    const service = new BillingService({} as never);

    await service.reconcileWebhookEvent({
      meta: {
        event_name: "subscription_paused",
        custom_data: {
          organization_id: "org-1",
          plan_type: "growth",
          billing_interval: "monthly",
        },
      },
      data: {
        id: "sub_123",
        attributes: {
          status: "paused",
          current_period_start: "2026-06-01T00:00:00.000Z",
          current_period_end: "2026-06-30T23:59:59.000Z",
          urls: {},
        },
      },
    });

    expect(state.updated.subscriptions[0]).toMatchObject({
      status: "paused",
      planType: "growth",
    });
    expect(state.updated.organizations[0]).toMatchObject({
      currentPlan: "growth",
      billingStatus: "subscription_paused",
    });
  });

  it("does not re-grant included credits on subscription_payment_success", async () => {
    const { state } = createDbHarness({
      organizations: [{ id: "org-1", currentPlan: "growth", billingStatus: "subscription_active" }],
      subscriptions: [
        {
          id: "local-sub-1",
          organizationId: "org-1",
          planType: "growth",
          status: "active",
          billingInterval: "monthly",
          currentPeriodStart: new Date("2026-06-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-06-30T23:59:59.000Z"),
          cancelled: "false",
          providerSubscriptionId: "sub_123",
        },
      ],
      verifiedCredits: [
        {
          organizationId: "org-1",
          month: "2026-06",
          includedGranted: 80,
          addonGranted: 25,
          used: 12,
          sourcePlan: "growth",
        },
      ],
    });
    const service = new BillingService({} as never);

    await service.reconcileWebhookEvent({
      meta: {
        event_name: "subscription_payment_success",
        custom_data: {
          organization_id: "org-1",
          plan_type: "growth",
          billing_interval: "monthly",
        },
      },
      data: {
        id: "sub_123",
        attributes: {
          status: "active",
          current_period_start: "2026-06-01T00:00:00.000Z",
          current_period_end: "2026-06-30T23:59:59.000Z",
          renews_at: "2026-07-01T00:00:00.000Z",
          urls: {},
        },
      },
    });

    expect(state.inserted.reconciliation).toHaveLength(0);
    expect(state.updated.credits).toHaveLength(0);
    expect(state.updated.organizations[0]).toMatchObject({
      currentPlan: "growth",
      billingStatus: "subscription_active",
    });
  });

  it("restores active status on payment recovery without double-granting included credits", async () => {
    const { state } = createDbHarness({
      organizations: [{ id: "org-1", currentPlan: "growth", billingStatus: "subscription_past_due" }],
      subscriptions: [
        {
          id: "local-sub-1",
          organizationId: "org-1",
          planType: "growth",
          status: "past_due",
          billingInterval: "monthly",
          currentPeriodStart: new Date("2026-06-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-06-30T23:59:59.000Z"),
          cancelled: "false",
          providerSubscriptionId: "sub_123",
        },
      ],
      verifiedCredits: [
        {
          organizationId: "org-1",
          month: "2026-06",
          includedGranted: 80,
          addonGranted: 25,
          used: 12,
          sourcePlan: "growth",
        },
      ],
    });
    const service = new BillingService({} as never);

    await service.reconcileWebhookEvent({
      meta: {
        event_name: "subscription_payment_recovered",
        custom_data: {
          organization_id: "org-1",
          plan_type: "growth",
          billing_interval: "monthly",
        },
      },
      data: {
        id: "sub_123",
        attributes: {
          status: "active",
          current_period_start: "2026-06-01T00:00:00.000Z",
          current_period_end: "2026-06-30T23:59:59.000Z",
          renews_at: "2026-07-01T00:00:00.000Z",
          urls: {},
        },
      },
    });

    expect(state.updated.subscriptions[0]).toMatchObject({
      status: "active",
      planType: "growth",
    });
    expect(state.updated.organizations[0]).toMatchObject({
      currentPlan: "growth",
      billingStatus: "subscription_active",
    });
    expect(state.inserted.reconciliation).toHaveLength(0);
  });

  it("grants sms top-up credits from order_created events and exposes them in billing status", async () => {
    const { state } = createDbHarness({
      subscriptions: [
        {
          id: "sub-local",
          organizationId: "org-1",
          planType: "starter",
          status: "active",
          billingInterval: "monthly",
          currentPeriodStart: new Date("2026-06-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-06-30T23:59:59.000Z"),
          cancelled: "false",
        },
      ],
      smsCredits: [
        {
          organizationId: "org-1",
          month: "2026-06",
          included: 300,
          addon: 0,
          used: 25,
          pausedReason: "none",
        },
      ],
    });
    const service = new BillingService({} as never);

    await service.reconcileWebhookEvent({
      meta: {
        event_name: "order_created",
        custom_data: {
          organization_id: "org-1",
          purchase_kind: "sms_segment_topup",
          sku: "sms-segment-topup-50",
          user_id: "user-1",
        },
      },
      data: {
        id: "order_sms_123",
        attributes: {},
      },
    });

    expect(state.inserted.smsAddons[0]).toMatchObject({
      organizationId: "org-1",
      packSize: 50,
      packPricePhp: 1099,
      purchasedByUserId: "user-1",
    });

    await expect(service.getBillingStatus("org-1")).resolves.toMatchObject({
      smsSegmentCredits: {
        included: 300,
        addon: 50,
        used: 25,
        total: 350,
        remaining: 325,
      },
    });
  });

  it("refunds unused verified booking top-up credits deterministically", async () => {
    const { state } = createDbHarness({
      verifiedCredits: [
        {
          organizationId: "org-1",
          month: "2026-06",
          includedGranted: 30,
          addonGranted: 25,
          used: 10,
          sourcePlan: "starter",
        },
      ],
    });
    const service = new BillingService({} as never);

    await service.reconcileWebhookEvent({
      meta: {
        event_name: "order_refunded",
        custom_data: {
          organization_id: "org-1",
          purchase_kind: "online_booking_topup",
          sku: "online-booking-topup-25",
        },
      },
      data: {
        id: "refund_booking_123",
        attributes: {},
      },
    });

    expect(state.updated.credits[0]).toMatchObject({
      addonGranted: 0,
      used: 10,
    });
    expect(state.inserted.reconciliation[0]).toMatchObject({
      organizationId: "org-1",
      creditType: "verified_online_booking",
      eventType: "refund_applied",
      addonBefore: 25,
      addonAfter: 0,
      providerEventId: "refund_booking_123",
    });
  });

  it("records a refund review instead of creating negative balances when refunded booking credits were already consumed", async () => {
    const { state } = createDbHarness({
      verifiedCredits: [
        {
          organizationId: "org-1",
          month: "2026-06",
          includedGranted: 30,
          addonGranted: 25,
          used: 55,
          sourcePlan: "starter",
        },
      ],
    });
    const service = new BillingService({} as never);

    await service.reconcileWebhookEvent({
      meta: {
        event_name: "order_refunded",
        custom_data: {
          organization_id: "org-1",
          purchase_kind: "online_booking_topup",
          sku: "online-booking-topup-25",
        },
      },
      data: {
        id: "refund_booking_456",
        attributes: {},
      },
    });

    expect(state.updated.credits).toHaveLength(0);
    expect(state.inserted.reconciliation[0]).toMatchObject({
      organizationId: "org-1",
      creditType: "verified_online_booking",
      eventType: "refund_review",
      addonBefore: 25,
      addonAfter: 25,
      usedBefore: 55,
      usedAfter: 55,
      providerEventId: "refund_booking_456",
    });
  });

  it("stores unknown webhook events as ignored no-ops instead of failing", async () => {
    const { state } = createDbHarness();
    const service = new BillingService({} as never);

    await service.reconcileWebhookEvent({
      meta: {
        event_name: "license_key_created",
      },
      data: {
        id: "noop_123",
        attributes: {},
      },
    });

    expect(state.inserted.subscriptions).toHaveLength(0);
    expect(state.updated.subscriptions).toHaveLength(0);

    expect(state.inserted.processedEvents[0]).toMatchObject({
      provider: "lemonsqueezy",
      eventName: "license_key_created",
      status: "processing",
      metadata: {
        resourceId: "noop_123",
      },
    });

    expect(state.inserted.processedEvents[0]?.eventId).toMatch(
      /^lemonsqueezy:[a-f0-9]{64}$/,
    );

    expect(state.updated.processedEvents[0]).toMatchObject({
      status: "ignored",
    });
  });
  it("changes to a higher plan immediately through Lemon Squeezy and waits for webhook activation", async () => {
    createDbHarness({
      subscriptions: [
        {
          id: "local-sub-1",
          organizationId: "org-1",
          planType: "starter",
          status: "active",
          billingInterval: "monthly",
          currentPeriodStart: new Date("2026-06-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-06-30T23:59:59.000Z"),
          cancelled: "false",
          providerSubscriptionId: "sub_123",
        },
      ],
    });
    process.env.LEMONSQUEEZY_VARIANT_GROWTH_MONTHLY = "222";
    const provider = {
      updateSubscription: vi.fn().mockResolvedValue({
        data: {
          id: "sub_123",
          attributes: { status: "active" },
        },
      }),
    };
    const service = new BillingService(provider as never);

    await expect(
      service.changePlan("org-1", { planType: "growth", billingInterval: "monthly" }),
    ).resolves.toMatchObject({
      organizationId: "org-1",
      subscriptionId: "local-sub-1",
      scheduled: false,
      pendingWebhookSync: true,
      planType: "growth",
      billingInterval: "monthly",
    });

    expect(provider.updateSubscription).toHaveBeenCalledWith("sub_123", {
      variantId: "222",
      invoiceImmediately: true,
    });
  });

  it("schedules lower-plan downgrades for the billing boundary and stores the scheduled target locally", async () => {
    const { state } = createDbHarness({
      subscriptions: [
        {
          id: "local-sub-1",
          organizationId: "org-1",
          planType: "growth",
          status: "active",
          billingInterval: "monthly",
          currentPeriodStart: new Date("2026-06-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-06-30T23:59:59.000Z"),
          renewsAt: new Date("2026-07-01T00:00:00.000Z"),
          cancelled: "false",
          providerSubscriptionId: "sub_123",
        },
      ],
    });
    process.env.LEMONSQUEEZY_VARIANT_STARTER_MONTHLY = "111";
    const provider = {
      updateSubscription: vi.fn().mockResolvedValue({
        data: {
          id: "sub_123",
          attributes: { status: "active" },
        },
      }),
    };
    const service = new BillingService(provider as never);

    await expect(
      service.changePlan("org-1", { planType: "starter", billingInterval: "monthly" }),
    ).resolves.toMatchObject({
      organizationId: "org-1",
      subscriptionId: "local-sub-1",
      scheduled: true,
      pendingWebhookSync: true,
      planType: "starter",
      billingInterval: "monthly",
    });

    expect(provider.updateSubscription).toHaveBeenCalledWith("sub_123", {
      variantId: "111",
      disableProrations: true,
    });
    expect(state.updated.subscriptions[0]).toMatchObject({
      scheduledPlanType: "starter",
      scheduledBillingInterval: "monthly",
      scheduledChangeEffectiveAt: new Date("2026-07-01T00:00:00.000Z"),
    });
  });

  it("cancels an active subscription in Lemon Squeezy and persists pending cancellation metadata", async () => {
    const { state } = createDbHarness({
      subscriptions: [
        {
          id: "local-sub-1",
          organizationId: "org-1",
          planType: "growth",
          status: "active",
          billingInterval: "monthly",
          currentPeriodStart: new Date("2026-06-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-06-30T23:59:59.000Z"),
          cancelled: "false",
          providerSubscriptionId: "sub_123",
        },
      ],
    });
    const provider = {
      cancelSubscription: vi.fn().mockResolvedValue({
        data: {
          id: "sub_123",
          attributes: {
            status: "cancelled",
            ends_at: "2026-06-30T23:59:59.000Z",
            renews_at: null,
          },
        },
      }),
    };
    const service = new BillingService(provider as never);

    await expect(service.cancel("org-1")).resolves.toMatchObject({
      organizationId: "org-1",
      subscriptionId: "local-sub-1",
      cancellationScheduled: true,
      pendingWebhookSync: true,
      endsAt: "2026-06-30T23:59:59.000Z",
    });

    expect(provider.cancelSubscription).toHaveBeenCalledWith("sub_123");
    expect(state.updated.subscriptions[0]).toMatchObject({
      cancelled: "true",
      status: "cancelled",
    });
  });

  it("resumes a cancelled subscription through Lemon Squeezy before the period ends", async () => {
    const { state } = createDbHarness({
      subscriptions: [
        {
          id: "local-sub-1",
          organizationId: "org-1",
          planType: "growth",
          status: "cancelled",
          billingInterval: "monthly",
          currentPeriodStart: new Date("2026-06-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-06-30T23:59:59.000Z"),
          endsAt: new Date("2026-06-30T23:59:59.000Z"),
          cancelled: "true",
          providerSubscriptionId: "sub_123",
        },
      ],
    });
    const provider = {
      updateSubscription: vi.fn().mockResolvedValue({
        data: {
          id: "sub_123",
          attributes: {
            status: "active",
            cancelled: false,
            ends_at: null,
            renews_at: "2026-07-01T00:00:00.000Z",
          },
        },
      }),
    };
    const service = new BillingService(provider as never);

    await expect(service.resume("org-1")).resolves.toMatchObject({
      organizationId: "org-1",
      subscriptionId: "local-sub-1",
      resumed: true,
      pendingWebhookSync: true,
    });

    expect(provider.updateSubscription).toHaveBeenCalledWith("sub_123", {
      cancelled: false,
    });
    expect(state.updated.subscriptions[0]).toMatchObject({
      cancelled: "false",
      status: "active",
      endsAt: null,
    });
  });
});
