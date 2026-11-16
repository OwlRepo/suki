import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { ConflictException, ServiceUnavailableException } from "@nestjs/common";
import { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
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
} from "@suki/database";
import { BillingService } from "./billing.service";

vi.mock("@suki/database", async () => {
  const actual = await vi.importActual<typeof import("@suki/database")>("@suki/database");
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
  provider?: "lemonsqueezy" | "manual" | null;
  graceUntil?: Date | null;
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
  bookingAddons?: Array<Record<string, unknown>>;
  smsAddons?: Array<Record<string, unknown>>;
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
  // opt-in: keep one verified-credit row per month and resolve selects/updates by the month in the where clause
  creditsByMonth?: boolean;
  // opt-in: keep every subscription row and resolve selects/updates by the rendered where clause
  subscriptionsBySql?: boolean;
}) {
  const state = {
    subscriptions: [...(input?.subscriptions ?? [])],
    verifiedCredits: [...(input?.verifiedCredits ?? [])],
    bookingAddons: [...(input?.bookingAddons ?? [])],
    smsAddons: [...(input?.smsAddons ?? [])],
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
      bookingAddons: [] as Array<Record<string, unknown>>,
      smsAddons: [] as Array<Record<string, unknown>>,
    },
    whereConditions: [] as Array<{ table: unknown; condition: unknown }>,
  };

  const sqlValueCount = (condition: unknown): number => {
    const seen = new Set<unknown>();
    const visit = (value: unknown): number => {
      if (!value || typeof value !== "object" || seen.has(value)) return 0;
      seen.add(value);
      let count = 0;
      if ("value" in value && !("name" in value)) count += 1;
      for (const nested of Object.values(value as Record<string, unknown>)) {
        if (Array.isArray(nested)) {
          count += nested.reduce((sum, item) => sum + visit(item), 0);
        } else {
          count += visit(nested);
        }
      }
      return count;
    };
    return visit(condition);
  };

  const sqlValues = (condition: unknown): unknown[] => {
    const seen = new Set<unknown>();
    const values: unknown[] = [];
    const visit = (value: unknown): void => {
      if (!value || typeof value !== "object" || seen.has(value)) return;
      seen.add(value);
      if ("value" in value && !("name" in value) && !Array.isArray(value.value)) {
        values.push(value.value);
      }
      for (const nested of Object.values(value as Record<string, unknown>)) {
        if (Array.isArray(nested)) nested.forEach(visit);
        else visit(nested);
      }
    };
    visit(condition);
    return values;
  };

  const dialect = new PgDialect();
  const render = (condition: unknown) => dialect.sqlToQuery(condition as SQL);
  const liveStatuses = ["active", "trialing", "past_due", "unpaid", "paused"];

  const isLiveLemonRow = (row: SubscriptionRow) =>
    row.provider === "lemonsqueezy" &&
    (liveStatuses.includes(row.status) ||
      (row.status === "cancelled" && !!row.endsAt && row.endsAt.getTime() > Date.now()));

  // Mirrors the where clauses BillingService builds on subscriptions; the live-subscription
  // lookup is always evaluated because it is new and has no legacy single-row behaviour.
  const matchSubscriptions = (condition: unknown): SubscriptionRow[] | null => {
    const { sql: text, params } = render(condition);
    const isLiveLookup = text.includes('"subscriptions"."status" in');
    if (!input?.subscriptionsBySql && !isLiveLookup) return null;
    const has = (fragment: string) => text.includes(`"subscriptions"."${fragment}`);
    return state.subscriptions.filter((row) => {
      if (has("organization_id\" =") && !params.includes(row.organizationId)) return false;
      if (has("id\" =") && !params.includes(row.id)) return false;
      if (has("provider\" =") && !params.includes(row.provider)) return false;
      if (has("provider\" is null") && row.provider) return false;
      if (has("provider_order_id\" =") && !params.includes(row.providerOrderId)) return false;
      if (has("provider_subscription_id\" is null") && row.providerSubscriptionId) return false;
      if (has("provider_subscription_id\" =") && !params.includes(row.providerSubscriptionId)) return false;
      if (has("provider_subscription_id\" <>") && params.includes(row.providerSubscriptionId)) return false;
      if (isLiveLookup) {
        const live =
          liveStatuses.includes(row.status) ||
          (row.status === "cancelled" && !!row.endsAt && row.endsAt.getTime() > Date.now());
        if (!live) return false;
      }
      return true;
    });
  };

  // Newest processed delivery for the subscription named in the where clause.
  const matchProcessedBySubscription = (condition: unknown) => {
    const { params } = render(condition);
    return state.processedEvents
      .filter((event) => event.status === "processed")
      .filter((event) =>
        params.includes((event.metadata as Record<string, unknown> | undefined)?.subscriptionId),
      )
      .sort(
        (a, b) =>
          ((b.processedAt as Date | undefined)?.getTime() ?? 0) -
          ((a.processedAt as Date | undefined)?.getTime() ?? 0),
      );
  };

  const select = vi.fn(() => ({
    from: (table: unknown) => ({
      where: (condition: unknown) => {
        state.whereConditions.push({ table, condition });
        return {
        orderBy: (...ordering: unknown[]) => ({
          limit: async () => {
            if (table === subscriptions) {
              const matched = matchSubscriptions(condition);
              if (!matched) return state.subscriptions.slice(0, 1);
              // opt-in with subscriptionsBySql: honour a liveness-first CASE ordering ahead of currentPeriodEnd
              const liveFirst =
                !!input?.subscriptionsBySql && ordering.some((term) => render(term).sql.toLowerCase().includes("case when"));
              const rank = (row: SubscriptionRow) =>
                liveFirst && isLiveLemonRow(row) ? 0 : 1;
              return [...matched]
                .sort(
                  (a, b) =>
                    rank(a) - rank(b) || b.currentPeriodEnd.getTime() - a.currentPeriodEnd.getTime(),
                )
                .slice(0, 1);
            }
            if (table === processedWebhookEvents) {
              return matchProcessedBySubscription(condition).slice(0, 1);
            }
            return [];
          },
        }),
        limit: async () => {
          if (table === subscriptions) {
            return (matchSubscriptions(condition) ?? state.subscriptions).slice(0, 1);
          }
          if (table === verifiedOnlineBookingCredits) {
            if (!input?.creditsByMonth) return state.verifiedCredits.slice(0, 1);
            const values = sqlValues(condition);
            return state.verifiedCredits.filter((row) => values.includes(row.month)).slice(0, 1);
          }
          if (table === smsCredits) return state.smsCredits.slice(0, 1);
          if (table === emailCredits) return state.emailCredits.slice(0, 1);
          if (table === aiUsageEvents) return state.aiUsageSummary.slice(0, 1);
          if (table === organizations) return state.organizations.slice(0, 1);
          if (table === processedWebhookEvents) return state.processedEvents.slice(0, 1);
          if (table === creditReconciliationEvents) return state.reconciliation.slice(0, 1);
          if (table === verifiedOnlineBookingAddons || table === smsAddons) {
            const rows = table === smsAddons ? state.smsAddons : state.bookingAddons;
            const values = sqlValues(condition);
            return rows.filter((row) => values.includes(row.sourceReference as string)).slice(0, 1);
          }
          return [];
        },
      };
      },
    }),
  }));

  const insert = vi.fn((table: unknown) => ({
    values: (value: Record<string, unknown>) => {
      const persistValue = () => {
        if (table === subscriptions) {
          state.inserted.subscriptions.push(value);
          state.subscriptions = input?.subscriptionsBySql
            ? [...state.subscriptions, value as unknown as SubscriptionRow]
            : [value as unknown as SubscriptionRow];
        } else if (table === verifiedOnlineBookingCredits) {
          state.inserted.credits.push(value);
          state.verifiedCredits = input?.creditsByMonth
            ? [...state.verifiedCredits, value as unknown as CreditRow]
            : [value as unknown as CreditRow];
        } else if (table === smsCredits) {
          state.inserted.smsCredits.push(value);
          state.smsCredits = [value as never];
        } else if (table === emailCredits) {
          state.inserted.emailCredits.push(value);
          state.emailCredits = [value as never];
        } else if (table === verifiedOnlineBookingAddons) {
          state.inserted.bookingAddons.push(value);
          state.bookingAddons = [...state.bookingAddons, value];
        } else if (table === smsAddons) {
          state.inserted.smsAddons.push(value);
          state.smsAddons = [...state.smsAddons, value];
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
        // mirrors ON CONFLICT (event_id) DO UPDATE ... WHERE status = 'failed'
        // OR (status = 'processing' AND processed_at < now - 10 minutes)
        onConflictDoUpdate: () => ({
          returning: async () => {
            const existing =
              table === processedWebhookEvents
                ? state.processedEvents.find((event) => event.eventId === value.eventId)
                : undefined;
            if (!existing) {
              persistValue();
              return [{ id: "processed-webhook-event-id" }];
            }
            const claimedAt = existing.processedAt as Date | undefined;
            const abandoned =
              existing.status === "processing" &&
              !!claimedAt &&
              claimedAt.getTime() < Date.now() - 10 * 60 * 1000;
            if (existing.status !== "failed" && !abandoned) return [];
            state.processedEvents = state.processedEvents.map((event) =>
              event === existing ? { ...event, status: "processing", processedAt: new Date() } : event,
            );
            return [{ id: "processed-webhook-event-id" }];
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

  // Grant services increment counters in SQL (`col + n`); resolve those against the stored row.
  const applySet = <T extends Record<string, unknown>>(row: T, value: Record<string, unknown>): T => {
    const next: Record<string, unknown> = { ...row };
    for (const [key, raw] of Object.entries(value)) {
      next[key] =
        raw instanceof SQL
          ? Number(row[key] ?? 0) + Number(raw.queryChunks.find((chunk) => typeof chunk === "number") ?? 0)
          : raw;
    }
    return next as T;
  };

  const update = vi.fn((table: unknown) => ({
    set: (value: Record<string, unknown>) => ({
      where: (condition: unknown) => {
        const applied = applyUpdate(table, value, condition);
        return {
          returning: async () => applied,
          then: (resolve: (v: unknown) => void) => resolve(undefined),
        };
      },
    }),
  }));

  const applyUpdate = (table: unknown, value: Record<string, unknown>, condition: unknown): unknown[] => {
        if (table === subscriptions) {
          state.updated.subscriptions.push(value);
          const matched = matchSubscriptions(condition);
          if (matched) {
            state.subscriptions = state.subscriptions.map((row) =>
              matched.includes(row) ? ({ ...row, ...value } as SubscriptionRow) : row,
            );
          } else if (state.subscriptions[0]) {
            state.subscriptions[0] = { ...state.subscriptions[0], ...value };
          }
        } else if (table === verifiedOnlineBookingCredits) {
          if (input?.creditsByMonth) {
            const values = sqlValues(condition);
            state.verifiedCredits = state.verifiedCredits.map((row) =>
              values.includes(row.month) ? applySet(row, value) : row,
            );
          } else if (state.verifiedCredits[0]) {
            state.verifiedCredits[0] = applySet(state.verifiedCredits[0], value);
          }
          const changed = input?.creditsByMonth
            ? state.verifiedCredits.filter((row) => sqlValues(condition).includes(row.month))
            : state.verifiedCredits.slice(0, 1);
          state.updated.credits.push(
            Object.values(value).some((v) => v instanceof SQL) ? { ...value, ...changed[0] } : value,
          );
          return changed;
        } else if (table === smsCredits) {
          if (state.smsCredits[0]) {
            state.smsCredits[0] = applySet(state.smsCredits[0] as Record<string, unknown>, value) as never;
          }
          return state.smsCredits.slice(0, 1);
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
          const values = sqlValues(condition);
          state.processedEvents = state.processedEvents.map((event) =>
            values.includes(event.eventId) ? { ...event, ...value } : event,
          );
        } else if (table === verifiedOnlineBookingAddons || table === smsAddons) {
          const key = table === smsAddons ? "smsAddons" : "bookingAddons";
          const ids = sqlValues(condition);
          state.updated[key].push(value);
          state[key] = state[key].map((row) => (ids.includes(row.id as string) ? { ...row, ...value } : row));
        }
        return [];
  };

  const tx = { select, insert, update };
  const db = {
    select,
    insert,
    update,
    transaction: vi.fn(async (cb: (trx: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  getDbMock.mockReturnValue(db as never);

  return { state, sqlValueCount };
}

describe("BillingService", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...envBackup,
      FF_self_serve_billing_enabled: "true",
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  async function expectBillingDisabled(action: () => Promise<unknown>) {
    try {
      await action();
      throw new Error("Expected billing action to be disabled");
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
        code: "BILLING_DISABLED",
      });
    }
  }

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
      monthlyPriceUsd: 45,
    });
  });

  it("rejects Lemon-backed billing mutations when self-serve billing is disabled", async () => {
    process.env.FF_self_serve_billing_enabled = "false";
    const provider = {
      createCheckout: vi.fn(),
      getSubscription: vi.fn(),
      updateSubscription: vi.fn(),
      cancelSubscription: vi.fn(),
    };
    const service = new BillingService(provider as never);

    await expectBillingDisabled(() =>
      service.createSubscriptionCheckout({
        organizationId: "org-1",
        userId: "user-1",
        planType: "growth",
        billingInterval: "monthly",
      }),
    );
    await expectBillingDisabled(() =>
      service.createAddonCheckout({
        organizationId: "org-1",
        userId: "user-1",
        sku: "sms-segment-topup-25",
      }),
    );
    await expectBillingDisabled(() =>
      service.createCustomerPortal("org-1"),
    );
    await expectBillingDisabled(() =>
      service.changePlan("org-1", {
        planType: "growth",
        billingInterval: "monthly",
      }),
    );
    await expectBillingDisabled(() => service.cancel("org-1"));
    await expectBillingDisabled(() => service.resume("org-1"));

    expect(provider.createCheckout).not.toHaveBeenCalled();
    expect(provider.getSubscription).not.toHaveBeenCalled();
    expect(provider.updateSubscription).not.toHaveBeenCalled();
    expect(provider.cancelSubscription).not.toHaveBeenCalled();
  });

  it("edge: FF_self_serve_billing_enabled=\"1\" enables checkout like the FeatureFlagsService", async () => {
    process.env.FF_self_serve_billing_enabled = "1";
    process.env.LEMONSQUEEZY_VARIANT_GROWTH_MONTHLY = "variant-growth-monthly";
    createDbHarness();
    const provider = {
      createCheckout: vi.fn().mockResolvedValue({ checkoutUrl: "https://checkout.example/x" }),
    };
    const service = new BillingService(provider as never);

    await service.createSubscriptionCheckout({
      organizationId: "org-1",
      userId: "user-1",
      planType: "growth",
      billingInterval: "monthly",
    });

    expect(provider.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ variantId: "variant-growth-monthly" }),
    );
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

  it("does not surface resolved refund-review warnings", async () => {
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
      reconciliation: [
        {
          organizationId: "org-1",
          creditType: "sms_segment",
          month: "2026-06",
          eventType: "refund_review",
          resolvedAt: new Date("2026-06-05T00:00:00.000Z"),
        },
      ],
    });
    const service = new BillingService({} as never);

    await expect(service.getBillingStatus("org-1")).resolves.toMatchObject({
      ownerWarnings: [],
    });
  });

  it("queries current-month ledgers with organization and month predicates", async () => {
    const { state, sqlValueCount } = createDbHarness({
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
      verifiedCredits: [
        {
          organizationId: "org-1",
          month: "2026-06",
          includedGranted: 80,
          addonGranted: 0,
          used: 4,
          sourcePlan: "growth",
        },
      ],
      smsCredits: [
        {
          organizationId: "org-1",
          month: "2026-06",
          included: 300,
          addon: 0,
          used: 5,
        },
      ],
      emailCredits: [
        {
          organizationId: "org-1",
          month: "2026-06",
          included: 5000,
          used: 10,
        },
      ],
    });
    const service = new BillingService({} as never);

    await service.getBillingStatus("org-1");

    for (const table of [
      verifiedOnlineBookingCredits,
      smsCredits,
      emailCredits,
    ]) {
      const condition = state.whereConditions.find((item) => item.table === table)?.condition;
      expect(sqlValueCount(condition)).toBeGreaterThanOrEqual(2);
    }
  });

  it("marks cancel as pending webhook sync without finalizing local lifecycle", async () => {
    const { state } = createDbHarness({
      subscriptions: [
        {
          id: "sub-local",
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
    const service = new BillingService({
      cancelSubscription: vi.fn().mockResolvedValue({
        data: {
          attributes: {
            ends_at: "2026-07-01T00:00:00.000Z",
            renews_at: null,
          },
        },
      }),
    } as never);

    await expect(service.cancel("org-1")).resolves.toMatchObject({
      cancellationScheduled: true,
      pendingWebhookSync: true,
    });

    expect(state.updated.subscriptions).toEqual([
      expect.objectContaining({
        pendingSyncAction: "cancel",
        pendingSyncTargetPlanType: "free",
      }),
    ]);
    expect(state.updated.subscriptions[0]).not.toHaveProperty("status");
    expect(state.updated.subscriptions[0]).not.toHaveProperty("cancelled");
    expect(state.updated.subscriptions[0]).not.toHaveProperty("endsAt");
    expect(state.updated.subscriptions[0]).not.toHaveProperty("renewsAt");
  });

  it("marks resume as pending webhook sync without finalizing local lifecycle", async () => {
    const { state } = createDbHarness({
      subscriptions: [
        {
          id: "sub-local",
          organizationId: "org-1",
          planType: "growth",
          status: "cancelled",
          billingInterval: "monthly",
          currentPeriodStart: new Date("2026-06-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-06-30T23:59:59.000Z"),
          endsAt: new Date("2026-07-01T00:00:00.000Z"),
          cancelled: "true",
          providerSubscriptionId: "sub_123",
        },
      ],
    });
    const service = new BillingService({
      updateSubscription: vi.fn().mockResolvedValue({
        data: { attributes: { status: "active" } },
      }),
    } as never);

    await expect(service.resume("org-1")).resolves.toMatchObject({
      resumed: true,
      pendingWebhookSync: true,
    });

    expect(state.updated.subscriptions).toEqual([
      expect.objectContaining({
        pendingSyncAction: "resume",
        pendingSyncTargetPlanType: "growth",
      }),
    ]);
    expect(state.updated.subscriptions[0]).not.toHaveProperty("status");
    expect(state.updated.subscriptions[0]).not.toHaveProperty("cancelled");
    expect(state.updated.subscriptions[0]).not.toHaveProperty("endsAt");
    expect(state.updated.subscriptions[0]).not.toHaveProperty("renewsAt");
  });

  function growthCreatedPayload() {
    return {
      meta: {
        event_name: "subscription_created",
        custom_data: { organization_id: "org-1", plan_type: "growth", billing_interval: "monthly" },
      },
      data: {
        id: "sub_email",
        attributes: {
          status: "active",
          variant_id: 222,
          renews_at: "2026-12-16T00:00:00.000Z",
          ends_at: null,
          cancelled: false,
          urls: {},
        },
      },
    };
  }

  it("regression: raises this month's included email allowance to the new plan without resetting usage", async () => {
    const { state } = createDbHarness({
      organizations: [{ id: "org-1", currentPlan: "free", billingStatus: "free_active" }],
      emailCredits: [{ organizationId: "org-1", month: "2026-11", included: 100, used: 7 }],
    });
    const service = new BillingService({} as never);

    await service.reconcileWebhookEvent(growthCreatedPayload());

    expect(state.emailCredits[0]).toMatchObject({ included: 5_000, used: 7 });
  });

  it("edge: creates this month's email allowance for the new plan when no email ledger exists yet", async () => {
    const { state } = createDbHarness({
      organizations: [{ id: "org-1", currentPlan: "free", billingStatus: "free_active" }],
    });
    const service = new BillingService({} as never);

    await service.reconcileWebhookEvent(growthCreatedPayload());

    expect(state.inserted.emailCredits[0]).toMatchObject({
      organizationId: "org-1",
      included: 5_000,
      used: 0,
    });
  });

  it("regression: raises this month's included sms allowance to the new plan without touching add-on or usage", async () => {
    const { state } = createDbHarness({
      organizations: [{ id: "org-1", currentPlan: "free", billingStatus: "free_active" }],
      smsCredits: [
        { organizationId: "org-1", month: "2026-11", included: 0, addon: 25, used: 3, pausedReason: "none" },
      ],
    });
    const service = new BillingService({} as never);

    await service.reconcileWebhookEvent(growthCreatedPayload());

    expect(state.smsCredits[0]).toMatchObject({ included: 800, addon: 25, used: 3, pausedReason: "none" });
    expect(state.inserted.smsCredits).toHaveLength(0);
  });

  it("edge: creates this month's sms allowance for the new plan when no sms ledger exists yet", async () => {
    const { state } = createDbHarness({
      organizations: [{ id: "org-1", currentPlan: "free", billingStatus: "free_active" }],
    });
    const service = new BillingService({} as never);

    await service.reconcileWebhookEvent(growthCreatedPayload());

    expect(state.inserted.smsCredits[0]).toMatchObject({
      organizationId: "org-1",
      included: 800,
      addon: 0,
      used: 0,
    });
  });

  it("edge: a scheduled downgrade leaves this month's included sms allowance unchanged", async () => {
    const { state } = createDbHarness({
      organizations: [{ id: "org-1", currentPlan: "growth", billingStatus: "subscription_active" }],
      subscriptions: [
        {
          id: "local-sub-1",
          organizationId: "org-1",
          planType: "growth",
          status: "active",
          billingInterval: "monthly",
          currentPeriodStart: new Date("2026-11-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-11-30T23:59:59.000Z"),
          cancelled: "false",
        },
      ],
      smsCredits: [{ organizationId: "org-1", month: "2026-11", included: 800, addon: 0, used: 10 }],
    });
    const service = new BillingService({} as never);

    await service.reconcileWebhookEvent({
      meta: {
        event_name: "subscription_updated",
        custom_data: { organization_id: "org-1", plan_type: "starter", billing_interval: "monthly" },
      },
      data: {
        id: "sub_email",
        attributes: { status: "active", renews_at: "2026-12-16T00:00:00.000Z", ends_at: null, cancelled: false, urls: {} },
      },
    });

    expect(state.subscriptions[0]).toMatchObject({ planType: "growth", scheduledPlanType: "starter" });
    expect(state.smsCredits[0]).toMatchObject({ included: 800, addon: 0, used: 10 });
    expect(state.inserted.smsCredits).toHaveLength(0);
  });

  it("regression: reconciles subscription_created into subscription, org state, and included booking credits", async () => {
    const { state } = createDbHarness({
      organizations: [
        {
          id: "org-1",
          currentPlan: "free",
          billingStatus: "free_active",
          accessEndsAt: new Date("2026-01-01T00:00:00.000Z"),
          billingPausedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
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
      // edge: plan_price_php is PHP-denominated; Lemon Squeezy charges USD, so no PHP amount is stored
      planPricePhp: 0,
    });
    expect(state.updated.organizations[0]).toMatchObject({
      currentPlan: "starter",
      billingStatus: "subscription_active",
      // edge: stale manual-era access dates must not force "suspended" once LS owns billing
      accessEndsAt: null,
      billingPausedAt: null,
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
      planPricePhp: 0,
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
      // edge: price_php stays PHP-denominated; the USD amount is kept in reconciliation metadata
      pricePhp: 0,
    });
    expect(state.inserted.reconciliation).toContainEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({ pricePhp: 0, priceUsd: 11 }),
      }),
    );
  });

  it("error: subscription_payment_failed invoice payload is ignored and does not overwrite the subscription", async () => {
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

    const result = await service.reconcileWebhookEvent({
      meta: {
        event_name: "subscription_payment_failed",
        custom_data: { organization_id: "org-1" },
      },
      data: {
        id: "inv_1",
        attributes: { subscription_id: 123, status: "pending", urls: { invoice_url: "https://billing.example/inv_1" } },
      },
    });

    expect(result).toBe("ignored");
    expect(state.updated.subscriptions).toHaveLength(0);
    expect(state.inserted.subscriptions).toHaveLength(0);
    expect(state.updated.organizations).toHaveLength(0);
  });

  it("regression: subscription_updated with past_due marks the org past due without downgrading the plan", async () => {
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

  it("error: subscription_payment_success invoice payload is ignored and writes no subscription or org rows", async () => {
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

    const result = await service.reconcileWebhookEvent({
      meta: {
        event_name: "subscription_payment_success",
        custom_data: {
          organization_id: "org-1",
          plan_type: "growth",
          billing_interval: "monthly",
        },
      },
      data: {
        id: "inv_1",
        attributes: { subscription_id: 123, status: "paid", urls: { invoice_url: "https://billing.example/inv_1" } },
      },
    });

    expect(state.inserted.reconciliation).toHaveLength(0);
    expect(state.updated.credits).toHaveLength(0);
    expect(result).toBe("ignored");
    expect(state.updated.subscriptions).toHaveLength(0);
    expect(state.updated.organizations).toHaveLength(0);
  });

  it("error: subscription_payment_recovered invoice payload is ignored (subscription_updated carries the state)", async () => {
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

    const result = await service.reconcileWebhookEvent({
      meta: {
        event_name: "subscription_payment_recovered",
        custom_data: {
          organization_id: "org-1",
          plan_type: "growth",
          billing_interval: "monthly",
        },
      },
      data: {
        id: "inv_2",
        attributes: { subscription_id: 123, status: "paid", urls: { invoice_url: "https://billing.example/inv_2" } },
      },
    });

    expect(result).toBe("ignored");
    expect(state.updated.subscriptions).toHaveLength(0);
    expect(state.updated.organizations).toHaveLength(0);
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
      packPricePhp: 0,
      purchasedByUserId: "user-1",
    });
    expect(state.inserted.reconciliation).toContainEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({ pricePhp: 0, priceUsd: 5 }),
      }),
    );

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

  it("regression: refunds unused verified booking top-up credits deterministically", async () => {
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
      bookingAddons: [
        {
          id: "addon-1",
          organizationId: "org-1",
          source: "lemonsqueezy",
          sourceReference: "refund_booking_123",
          sku: "online-booking-topup-25",
          units: 25,
          refundedUnits: 0,
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
    expect(state.updated.bookingAddons[0]).toMatchObject({
      refundedUnits: 25,
    });
  });

  it("regression: refunds unused sms top-up credits and records refunded add-on units", async () => {
    const { state } = createDbHarness({
      smsCredits: [
        {
          organizationId: "org-1",
          month: "2026-06",
          included: 300,
          addon: 50,
          used: 25,
        },
      ],
      smsAddons: [
        {
          id: "sms-addon-1",
          organizationId: "org-1",
          source: "lemonsqueezy",
          sourceReference: "refund_sms_123",
          packSize: 50,
          refundedUnits: 0,
        },
      ],
    });
    const service = new BillingService({} as never);

    await service.reconcileWebhookEvent({
      meta: {
        event_name: "order_refunded",
        custom_data: {
          organization_id: "org-1",
          purchase_kind: "sms_segment_topup",
          sku: "sms-segment-topup-50",
        },
      },
      data: {
        id: "refund_sms_123",
        attributes: {},
      },
    });

    expect(state.updated.smsAddons[0]).toMatchObject({
      refundedUnits: 50,
    });
    expect(state.inserted.reconciliation[0]).toMatchObject({
      creditType: "sms_segment",
      eventType: "refund_applied",
      addonBefore: 50,
      addonAfter: 0,
    });
  });

  it("regression: marks only the refunded order's sms add-on when several packs share a size", async () => {
    const { state } = createDbHarness({
      smsCredits: [{ organizationId: "org-1", month: "2026-11", included: 0, addon: 50, used: 0 }],
      smsAddons: [
        { id: "sms-old", organizationId: "org-1", source: "lemonsqueezy", sourceReference: "order_old", packSize: 25, refundedUnits: 0 },
        { id: "sms-new", organizationId: "org-1", source: "lemonsqueezy", sourceReference: "order_new", packSize: 25, refundedUnits: 0 },
      ],
    });
    const service = new BillingService({} as never);

    await service.reconcileWebhookEvent({
      meta: {
        event_name: "order_refunded",
        custom_data: { organization_id: "org-1", purchase_kind: "sms_segment_topup", sku: "sms-segment-topup-25" },
      },
      data: { id: "order_new", attributes: {} },
    });

    expect(state.smsAddons.find((row) => row.id === "sms-new")).toMatchObject({ refundedUnits: 25 });
    expect(state.smsAddons.find((row) => row.id === "sms-old")).toMatchObject({ refundedUnits: 0 });
  });

  it("regression: marks only the refunded order's booking add-on when several packs share a sku", async () => {
    const { state } = createDbHarness({
      verifiedCredits: [
        { organizationId: "org-1", month: "2026-11", includedGranted: 30, addonGranted: 50, used: 0, sourcePlan: "starter" },
      ],
      bookingAddons: [
        { id: "bk-old", organizationId: "org-1", source: "lemonsqueezy", sourceReference: "order_old", sku: "online-booking-topup-25", units: 25, refundedUnits: 0 },
        { id: "bk-new", organizationId: "org-1", source: "lemonsqueezy", sourceReference: "order_new", sku: "online-booking-topup-25", units: 25, refundedUnits: 0 },
      ],
    });
    const service = new BillingService({} as never);

    await service.reconcileWebhookEvent({
      meta: {
        event_name: "order_refunded",
        custom_data: { organization_id: "org-1", purchase_kind: "online_booking_topup", sku: "online-booking-topup-25" },
      },
      data: { id: "order_new", attributes: {} },
    });

    expect(state.bookingAddons.find((row) => row.id === "bk-new")).toMatchObject({ refundedUnits: 25 });
    expect(state.bookingAddons.find((row) => row.id === "bk-old")).toMatchObject({ refundedUnits: 0 });
  });

  it("edge: a refund with no matching add-on record still reverses credits and marks no other pack", async () => {
    const { state } = createDbHarness({
      smsCredits: [{ organizationId: "org-1", month: "2026-11", included: 0, addon: 25, used: 0 }],
      smsAddons: [
        { id: "sms-other", organizationId: "org-1", source: "lemonsqueezy", sourceReference: "order_other", packSize: 25, refundedUnits: 0 },
      ],
    });
    const service = new BillingService({} as never);

    await service.reconcileWebhookEvent({
      meta: {
        event_name: "order_refunded",
        custom_data: { organization_id: "org-1", purchase_kind: "sms_segment_topup", sku: "sms-segment-topup-25" },
      },
      data: { id: "order_missing", attributes: {} },
    });

    expect(state.updated.smsAddons).toHaveLength(0);
    expect(state.inserted.reconciliation[0]).toMatchObject({ creditType: "sms_segment", eventType: "refund_applied", addonAfter: 0 });
  });

  it("edge: a refund that creates this month's sms ledger seeds the org plan's included allowance", async () => {
    const { state } = createDbHarness({
      organizations: [{ id: "org-1", currentPlan: "growth", billingStatus: "subscription_active" }],
    });
    const service = new BillingService({} as never);

    await service.reconcileWebhookEvent({
      meta: {
        event_name: "order_refunded",
        custom_data: { organization_id: "org-1", purchase_kind: "sms_segment_topup", sku: "sms-segment-topup-25" },
      },
      data: { id: "order_missing", attributes: {} },
    });

    expect(state.inserted.smsCredits[0]).toMatchObject({ organizationId: "org-1", included: 800, addon: 0, used: 0 });
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

  it("marks webhook events as failed when reconciliation throws", async () => {
    const { state } = createDbHarness();
    const service = new BillingService({} as never);

    await expect(
      service.reconcileWebhookEvent({
        meta: {
          event_name: "order_created",
          custom_data: {
            organization_id: "org-1",
            purchase_kind: "online_booking_topup",
            sku: "not-a-real-sku",
          },
        },
        data: {
          id: "order_bad_123",
          attributes: {},
        },
      }),
    ).rejects.toThrow();

    expect(state.updated.processedEvents[0]).toMatchObject({
      status: "failed",
      failureReason: expect.any(String),
    });
  });

  it("error: webhook reconciliation throws 503 BILLING_DISABLED when self-serve billing is off", async () => {
    process.env.FF_self_serve_billing_enabled = "false";
    const { state } = createDbHarness();
    const service = new BillingService({} as never);

    await expectBillingDisabled(() =>
      service.reconcileWebhookEvent({
        meta: {
          event_name: "subscription_created",
          custom_data: {
            organization_id: "org-1",
          },
        },
        data: {
          id: "sub_123",
          attributes: {},
        },
      }),
    );

    expect(state.inserted.processedEvents).toHaveLength(0);
    expect(state.updated.processedEvents).toHaveLength(0);
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

  it("regression: schedules lower-plan downgrades for the billing boundary and stores the scheduled target locally", async () => {
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
      pendingSyncAction: "cancel",
      pendingSyncTargetPlanType: "free",
      pendingSyncTargetBillingInterval: "monthly",
    });
    expect(state.updated.subscriptions[0]).not.toHaveProperty("cancelled");
    expect(state.updated.subscriptions[0]).not.toHaveProperty("status");
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
      pendingSyncAction: "resume",
      pendingSyncTargetPlanType: "growth",
      pendingSyncTargetBillingInterval: "monthly",
    });
    expect(state.updated.subscriptions[0]).not.toHaveProperty("cancelled");
    expect(state.updated.subscriptions[0]).not.toHaveProperty("status");
    expect(state.updated.subscriptions[0]).not.toHaveProperty("endsAt");
  });
  describe("Lemon Squeezy subscription payloads without current_period_* fields", () => {
    const lsSubscriptionEvent = (
      eventName: string,
      attributes: Record<string, unknown>,
      billingInterval: "monthly" | "annual" = "monthly",
    ) => ({
      meta: {
        event_name: eventName,
        custom_data: {
          organization_id: "org-1",
          plan_type: "starter",
          billing_interval: billingInterval,
        },
      },
      data: {
        id: "sub_ls_1",
        attributes: {
          status: "active",
          customer_id: 654,
          order_id: 987,
          product_id: 321,
          variant_id: 111,
          created_at: "2026-06-15T10:00:00.000000Z",
          trial_ends_at: null,
          ends_at: null,
          cancelled: false,
          ...attributes,
        },
      },
    });

    it("edge: derives a cancelled subscription's period end from ends_at when renews_at is absent", async () => {
      const { state } = createDbHarness({ creditsByMonth: true });
      const service = new BillingService({} as never);

      await service.reconcileWebhookEvent(
        lsSubscriptionEvent("subscription_cancelled", {
          status: "cancelled",
          cancelled: true,
          renews_at: null,
          ends_at: "2026-07-15T10:00:00.000000Z",
          updated_at: "2026-06-20T10:00:00.000000Z",
        }),
      );

      expect(state.inserted.subscriptions[0]).toMatchObject({
        currentPeriodStart: new Date("2026-06-15T10:00:00.000Z"),
        currentPeriodEnd: new Date("2026-07-15T10:00:00.000Z"),
      });
    });

    it("edge: clamps a month-end renewal to the last day of the previous month", async () => {
      const { state } = createDbHarness({ creditsByMonth: true });
      const service = new BillingService({} as never);

      await service.reconcileWebhookEvent(
        lsSubscriptionEvent("subscription_created", {
          renews_at: "2026-03-31T10:00:00.000000Z",
          updated_at: "2026-02-28T10:00:00.000000Z",
        }),
      );

      expect(state.inserted.subscriptions[0]).toMatchObject({
        currentPeriodStart: new Date("2026-02-28T10:00:00.000Z"),
        currentPeriodEnd: new Date("2026-03-31T10:00:00.000Z"),
      });
      expect(state.inserted.credits.map((row) => row.month)).toEqual(["2026-02"]);
    });

    it("edge: derives a one-year period for annual subscriptions from renews_at", async () => {
      const { state } = createDbHarness({ creditsByMonth: true });
      const service = new BillingService({} as never);

      await service.reconcileWebhookEvent(
        lsSubscriptionEvent(
          "subscription_created",
          {
            renews_at: "2027-06-15T10:00:00.000000Z",
            updated_at: "2026-06-15T10:00:00.000000Z",
          },
          "annual",
        ),
      );

      expect(state.inserted.subscriptions[0]).toMatchObject({
        currentPeriodStart: new Date("2026-06-15T10:00:00.000Z"),
        currentPeriodEnd: new Date("2027-06-15T10:00:00.000Z"),
      });
    });

    it("regression: a renewal subscription_updated grants the new month's included credits exactly once", async () => {
      const { state } = createDbHarness({ creditsByMonth: true });
      const service = new BillingService({} as never);

      await service.reconcileWebhookEvent(
        lsSubscriptionEvent("subscription_created", {
          renews_at: "2026-07-15T10:00:00.000000Z",
          updated_at: "2026-06-15T10:00:00.000000Z",
        }),
      );
      const renewal = lsSubscriptionEvent("subscription_updated", {
        renews_at: "2026-08-15T10:00:00.000000Z",
        updated_at: "2026-07-15T10:00:05.000000Z",
      });
      await service.reconcileWebhookEvent(renewal, "lemonsqueezy:renewal-delivery-1");
      // a second delivery for the same billing period (distinct key) must not grant again
      await service.reconcileWebhookEvent(renewal, "lemonsqueezy:renewal-delivery-2");

      expect(state.subscriptions[0]).toMatchObject({
        currentPeriodStart: new Date("2026-07-15T10:00:00.000Z"),
        currentPeriodEnd: new Date("2026-08-15T10:00:00.000Z"),
      });
      expect(state.inserted.credits.map((row) => row.month)).toEqual(["2026-06", "2026-07"]);
      expect(state.inserted.credits[1]).toMatchObject({
        organizationId: "org-1",
        includedGranted: 30,
        used: 0,
        sourcePlan: "starter",
      });
    });
  });

  describe("webhook delivery retries", () => {
    const subscriptionPayload = {
      meta: {
        event_name: "subscription_updated",
        custom_data: { organization_id: "org-1", plan_type: "starter", billing_interval: "monthly" },
      },
      data: {
        id: "sub_retry_1",
        attributes: {
          status: "active",
          renews_at: "2026-07-15T10:00:00.000000Z",
          updated_at: "2026-06-15T10:00:00.000000Z",
        },
      },
    };

    const spyOnSubscriptionReconcile = (service: BillingService) =>
      vi.spyOn(
        service as unknown as { reconcileSubscriptionEvent: (...args: unknown[]) => Promise<void> },
        "reconcileSubscriptionEvent",
      );

    it("error: a retried delivery of a failed event is reprocessed instead of reported as duplicate", async () => {
      const { state } = createDbHarness();
      const service = new BillingService({} as never);
      const reconcile = spyOnSubscriptionReconcile(service).mockRejectedValueOnce(
        new Error("database unavailable"),
      );

      await expect(service.reconcileWebhookEvent(subscriptionPayload)).rejects.toThrow(
        "database unavailable",
      );
      expect(state.processedEvents[0]).toMatchObject({ status: "failed" });

      await expect(service.reconcileWebhookEvent(subscriptionPayload)).resolves.toBe("processed");
      expect(reconcile).toHaveBeenCalledTimes(2);
      expect(state.processedEvents).toHaveLength(1);
      expect(state.processedEvents[0]).toMatchObject({ status: "processed" });
    });

    it("edge: a delivery still processing is reported as duplicate and not reprocessed", async () => {
      createDbHarness({
        processedEvents: [{ eventId: "lemonsqueezy:in-flight", status: "processing" }],
      });
      const service = new BillingService({} as never);
      const reconcile = spyOnSubscriptionReconcile(service);

      await expect(
        service.reconcileWebhookEvent(subscriptionPayload, "lemonsqueezy:in-flight"),
      ).resolves.toBe("duplicate");
      expect(reconcile).not.toHaveBeenCalled();
    });

    it("regression: a retried delivery of a processed event stays duplicate", async () => {
      createDbHarness();
      const service = new BillingService({} as never);
      const reconcile = spyOnSubscriptionReconcile(service);

      await expect(service.reconcileWebhookEvent(subscriptionPayload)).resolves.toBe("processed");
      await expect(service.reconcileWebhookEvent(subscriptionPayload)).resolves.toBe("duplicate");
      expect(reconcile).toHaveBeenCalledTimes(1);
    });
  });
  describe("Lemon Squeezy subscription sync", () => {
    const NOW = new Date("2026-11-16T00:00:00.000Z");
    const DAY_MS = 24 * 60 * 60 * 1000;

    beforeEach(() => {
      vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const lsRow = (overrides: Partial<SubscriptionRow> = {}): SubscriptionRow => ({
      id: "row-a",
      organizationId: "org-1",
      planType: "growth",
      status: "active",
      billingInterval: "monthly",
      currentPeriodStart: new Date("2026-11-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-12-01T00:00:00.000Z"),
      renewsAt: new Date("2026-12-01T00:00:00.000Z"),
      cancelled: "false",
      provider: "lemonsqueezy",
      providerSubscriptionId: "sub_a",
      providerOrderId: "order_a",
      ...overrides,
    });

    const subscriptionEvent = (
      eventName: string,
      attributes: Record<string, unknown> = {},
      options: { id?: string; customData?: Record<string, unknown> } = {},
    ) => ({
      meta: {
        event_name: eventName,
        custom_data: {
          organization_id: "org-1",
          plan_type: "growth",
          billing_interval: "monthly",
          ...options.customData,
        },
      },
      data: {
        id: options.id ?? "sub_a",
        attributes: {
          status: "active",
          renews_at: "2026-12-16T00:00:00.000Z",
          ends_at: null,
          cancelled: false,
          urls: {},
          updated_at: "2026-11-16T00:00:00.000Z",
          ...attributes,
        },
      },
    });

    const orderRefundedEvent = (attributes: Record<string, unknown>) => ({
      meta: {
        event_name: "order_refunded",
        custom_data: { organization_id: "org-1", purchase_kind: "subscription", plan_type: "growth" },
      },
      data: { id: "order_a", attributes },
    });

    const subscriptionPaymentRefundedEvent = (attributes: Record<string, unknown>) => ({
      meta: {
        event_name: "subscription_payment_refunded",
        custom_data: { organization_id: "org-1" },
      },
      data: { id: "inv_1", attributes: { subscription_id: "sub_a", ...attributes } },
    });

    const lemonProvider = (providerAttributes: Record<string, unknown> = { status: "active", cancelled: false }) => ({
      createCheckout: vi.fn().mockResolvedValue({ checkoutUrl: "https://checkout.example/x" }),
      updateSubscription: vi.fn().mockResolvedValue({ data: { attributes: { status: "active" } } }),
      getSubscription: vi.fn().mockResolvedValue({ data: { id: "sub_a", attributes: providerAttributes } }),
      cancelSubscription: vi.fn().mockResolvedValue({ data: { attributes: { status: "cancelled" } } }),
    });

    const expectConflict = async (action: Promise<unknown>, code: string) => {
      const error = await action.then(
        () => null,
        (err: unknown) => err,
      );
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({ code });
    };

    const lastProcessedMetadata = (state: ReturnType<typeof createDbHarness>["state"]) =>
      state.processedEvents[state.processedEvents.length - 1]?.metadata as Record<string, unknown> | undefined;

    it("error: createSubscriptionCheckout rejects with 409 when the org has an active Lemon Squeezy subscription", async () => {
      process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY = "333";
      createDbHarness({ subscriptionsBySql: true, subscriptions: [lsRow()] });
      const provider = lemonProvider();
      const service = new BillingService(provider as never);

      await expectConflict(
        service.createSubscriptionCheckout({ organizationId: "org-1", userId: "user-1", planType: "pro", billingInterval: "monthly" }),
        "SUBSCRIPTION_EXISTS",
      );
      expect(provider.createCheckout).not.toHaveBeenCalled();
    });

    it("error: createSubscriptionCheckout rejects with 409 when a cancelled subscription still runs until ends_at", async () => {
      process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY = "333";
      createDbHarness({
        subscriptionsBySql: true,
        subscriptions: [lsRow({ status: "cancelled", cancelled: "true", endsAt: new Date(NOW.getTime() + 5 * DAY_MS) })],
      });
      const provider = lemonProvider();
      const service = new BillingService(provider as never);

      await expectConflict(
        service.createSubscriptionCheckout({ organizationId: "org-1", userId: "user-1", planType: "pro", billingInterval: "monthly" }),
        "SUBSCRIPTION_EXISTS",
      );
      expect(provider.createCheckout).not.toHaveBeenCalled();
    });

    it("error: changePlan rejects an expired subscription with 409 SUBSCRIPTION_NOT_ACTIVE", async () => {
      process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY = "333";
      createDbHarness({ subscriptionsBySql: true, subscriptions: [lsRow({ status: "expired", cancelled: "true" })] });
      const provider = lemonProvider();
      const service = new BillingService(provider as never);

      await expectConflict(
        service.changePlan("org-1", { planType: "pro", billingInterval: "monthly" }),
        "SUBSCRIPTION_NOT_ACTIVE",
      );
      expect(provider.updateSubscription).not.toHaveBeenCalled();
    });

    it("error: changePlan rejects a cancelled subscription whose ends_at has passed", async () => {
      process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY = "333";
      createDbHarness({
        subscriptionsBySql: true,
        subscriptions: [lsRow({ status: "cancelled", cancelled: "true", endsAt: new Date(NOW.getTime() - DAY_MS) })],
      });
      const provider = lemonProvider();
      const service = new BillingService(provider as never);

      await expectConflict(
        service.changePlan("org-1", { planType: "pro", billingInterval: "monthly" }),
        "SUBSCRIPTION_NOT_ACTIVE",
      );
      expect(provider.updateSubscription).not.toHaveBeenCalled();
    });

    it("error: subscription event without organization_id is stored ignored with reason missing_organization_id", async () => {
      const { state } = createDbHarness({ subscriptionsBySql: true });
      const service = new BillingService({} as never);

      const result = await service.reconcileWebhookEvent(
        subscriptionEvent("subscription_updated", {}, { customData: { organization_id: undefined } }),
      );

      expect(result).toBe("ignored");
      expect(state.processedEvents[0]).toMatchObject({
        status: "ignored",
        metadata: expect.objectContaining({ reason: "missing_organization_id" }),
      });
      expect(state.inserted.subscriptions).toHaveLength(0);
    });

    it("error: a stale subscription event (updated_at older than the last processed one) is ignored and writes nothing", async () => {
      const { state } = createDbHarness({
        subscriptionsBySql: true,
        organizations: [{ id: "org-1", currentPlan: "growth", billingStatus: "subscription_active" }],
        subscriptions: [lsRow()],
        processedEvents: [
          {
            provider: "lemonsqueezy",
            eventId: "lemonsqueezy:newer-delivery",
            status: "processed",
            processedAt: new Date(NOW.getTime() - 60_000),
            metadata: { resourceId: "sub_a", subscriptionId: "sub_a", providerUpdatedAt: "2026-11-15T12:00:00.000Z" },
          },
        ],
      });
      const service = new BillingService({} as never);

      const result = await service.reconcileWebhookEvent(
        subscriptionEvent("subscription_updated", { status: "past_due", updated_at: "2026-11-15T00:00:00.000Z" }),
      );

      expect(result).toBe("ignored");
      expect(state.updated.subscriptions).toHaveLength(0);
      expect(state.inserted.subscriptions).toHaveLength(0);
      expect(state.updated.organizations).toHaveLength(0);
      expect(lastProcessedMetadata(state)).toMatchObject({ reason: "stale_provider_event" });
    });

    it("edge: an event with the same updated_at as the last processed one is still applied", async () => {
      const { state } = createDbHarness({
        subscriptionsBySql: true,
        organizations: [{ id: "org-1", currentPlan: "growth", billingStatus: "subscription_active" }],
        subscriptions: [lsRow()],
        processedEvents: [
          {
            provider: "lemonsqueezy",
            eventId: "lemonsqueezy:same-time",
            status: "processed",
            processedAt: new Date(NOW.getTime() - 60_000),
            metadata: { subscriptionId: "sub_a", providerUpdatedAt: "2026-11-16T00:00:00.000Z" },
          },
        ],
      });
      const service = new BillingService({} as never);

      await expect(service.reconcileWebhookEvent(subscriptionEvent("subscription_updated"))).resolves.toBe("processed");
      expect(state.updated.subscriptions).toHaveLength(1);
      expect(lastProcessedMetadata(state)).toMatchObject({
        subscriptionId: "sub_a",
        providerUpdatedAt: "2026-11-16T00:00:00.000Z",
      });
    });

    it("edge: a delivery stuck in processing for over 10 minutes is re-claimed and reprocessed", async () => {
      const { state } = createDbHarness({
        subscriptionsBySql: true,
        organizations: [{ id: "org-1", currentPlan: "growth", billingStatus: "subscription_active" }],
        subscriptions: [lsRow()],
        processedEvents: [
          {
            provider: "lemonsqueezy",
            eventId: "lemonsqueezy:stuck",
            status: "processing",
            processedAt: new Date(NOW.getTime() - 11 * 60 * 1000),
          },
        ],
      });
      const service = new BillingService({} as never);

      await expect(
        service.reconcileWebhookEvent(subscriptionEvent("subscription_updated"), "lemonsqueezy:stuck"),
      ).resolves.toBe("processed");
      expect(state.processedEvents).toHaveLength(1);
      expect(state.processedEvents[0]).toMatchObject({ status: "processed" });
      expect(state.updated.subscriptions).toHaveLength(1);
    });

    it("edge: an event for subscription B creates a new row and never overwrites the row tracking subscription A", async () => {
      const { state } = createDbHarness({
        subscriptionsBySql: true,
        organizations: [{ id: "org-1", currentPlan: "growth", billingStatus: "subscription_active" }],
        subscriptions: [lsRow()],
      });
      const service = new BillingService({} as never);

      await service.reconcileWebhookEvent(subscriptionEvent("subscription_created", {}, { id: "sub_b" }));

      expect(state.inserted.subscriptions).toHaveLength(1);
      expect(state.inserted.subscriptions[0]).toMatchObject({ providerSubscriptionId: "sub_b" });
      expect(state.updated.subscriptions).toHaveLength(0);
      expect(state.subscriptions.find((row) => row.id === "row-a")).toMatchObject({
        providerSubscriptionId: "sub_a",
        status: "active",
      });
    });

    it("edge: an event for an ended subscription does not change the org plan while another live subscription exists", async () => {
      const { state } = createDbHarness({
        subscriptionsBySql: true,
        organizations: [{ id: "org-1", currentPlan: "pro", billingStatus: "subscription_active" }],
        subscriptions: [
          lsRow({ id: "row-a", planType: "pro" }),
          lsRow({ id: "row-b", providerSubscriptionId: "sub_b", providerOrderId: "order_b" }),
        ],
      });
      const service = new BillingService({} as never);

      await expect(
        service.reconcileWebhookEvent(
          subscriptionEvent("subscription_expired", { status: "expired", cancelled: true, ends_at: "2026-11-15T00:00:00.000Z" }, { id: "sub_b" }),
        ),
      ).resolves.toBe("processed");

      expect(state.subscriptions.find((row) => row.id === "row-b")).toMatchObject({ status: "expired" });
      expect(state.subscriptions.find((row) => row.id === "row-a")).toMatchObject({ status: "active", planType: "pro" });
      expect(state.updated.organizations).toHaveLength(0);
      expect(lastProcessedMetadata(state)).toMatchObject({ reason: "superseded_subscription" });
    });

    it("edge: first event for an org with only a provider-less trial row adopts that row", async () => {
      const { state } = createDbHarness({
        subscriptionsBySql: true,
        organizations: [{ id: "org-1", currentPlan: "starter", billingStatus: "trial_active" }],
        subscriptions: [
          lsRow({ id: "trial-row", planType: "starter", status: "trialing", provider: null, providerSubscriptionId: null, providerOrderId: null }),
        ],
      });
      const service = new BillingService({} as never);

      await service.reconcileWebhookEvent(subscriptionEvent("subscription_created"));

      expect(state.inserted.subscriptions).toHaveLength(0);
      expect(state.subscriptions).toHaveLength(1);
      expect(state.subscriptions[0]).toMatchObject({
        id: "trial-row",
        provider: "lemonsqueezy",
        providerSubscriptionId: "sub_a",
        planType: "growth",
      });
    });

    it("edge: past_due keeps the paid plan, sets graceUntil = now+7d and grants no included credits", async () => {
      const { state } = createDbHarness({
        subscriptionsBySql: true,
        organizations: [{ id: "org-1", currentPlan: "growth", billingStatus: "subscription_active" }],
        subscriptions: [lsRow()],
      });
      const service = new BillingService({} as never);

      await service.reconcileWebhookEvent(subscriptionEvent("subscription_updated", { status: "past_due" }));

      expect(state.subscriptions[0]).toMatchObject({
        status: "past_due",
        planType: "growth",
        graceUntil: new Date(NOW.getTime() + 7 * DAY_MS),
      });
      expect(state.updated.organizations[0]).toMatchObject({
        currentPlan: "growth",
        billingStatus: "subscription_past_due",
      });
      expect(state.inserted.credits).toHaveLength(0);
      expect(state.updated.credits).toHaveLength(0);
      expect(state.inserted.emailCredits).toHaveLength(0);
    });

    it("edge: a second past_due event keeps the original graceUntil", async () => {
      const firstGrace = new Date(NOW.getTime() + 3 * DAY_MS);
      const { state } = createDbHarness({
        subscriptionsBySql: true,
        organizations: [{ id: "org-1", currentPlan: "growth", billingStatus: "subscription_past_due" }],
        subscriptions: [lsRow({ status: "past_due", graceUntil: firstGrace })],
      });
      const service = new BillingService({} as never);

      await service.reconcileWebhookEvent(subscriptionEvent("subscription_updated", { status: "past_due" }));

      expect(state.subscriptions[0]).toMatchObject({ status: "past_due", graceUntil: firstGrace });
      expect(state.updated.organizations[0]).toMatchObject({ currentPlan: "growth" });
    });

    it("edge: past_due arriving after graceUntil sets the org plan to free", async () => {
      const { state } = createDbHarness({
        subscriptionsBySql: true,
        organizations: [{ id: "org-1", currentPlan: "growth", billingStatus: "subscription_past_due" }],
        subscriptions: [lsRow({ status: "past_due", graceUntil: new Date(NOW.getTime() - DAY_MS) })],
      });
      const service = new BillingService({} as never);

      await service.reconcileWebhookEvent(subscriptionEvent("subscription_updated", { status: "unpaid" }));

      expect(state.updated.organizations[0]).toMatchObject({
        currentPlan: "free",
        billingStatus: "subscription_past_due",
      });
    });

    it("edge: subscription refund replay does not call cancelSubscription again when the row is already cancelled", async () => {
      const { state } = createDbHarness({
        subscriptionsBySql: true,
        subscriptions: [lsRow({ status: "cancelled", cancelled: "true", endsAt: new Date(NOW.getTime() + 10 * DAY_MS) })],
      });
      const provider = lemonProvider();
      const service = new BillingService(provider as never);

      await expect(service.reconcileWebhookEvent(orderRefundedEvent({ status: "refunded" }))).resolves.toBe("processed");

      expect(provider.getSubscription).not.toHaveBeenCalled();
      expect(provider.cancelSubscription).not.toHaveBeenCalled();
      expect(lastProcessedMetadata(state)).toMatchObject({ reason: "subscription_already_cancelled" });
    });

    it("edge: subscription refund skips cancelSubscription when Lemon Squeezy already reports it cancelled", async () => {
      const { state } = createDbHarness({ subscriptionsBySql: true, subscriptions: [lsRow()] });
      const provider = lemonProvider({ status: "cancelled", cancelled: true });
      const service = new BillingService(provider as never);

      await service.reconcileWebhookEvent(orderRefundedEvent({ status: "refunded" }));

      expect(provider.getSubscription).toHaveBeenCalledWith("sub_a");
      expect(provider.cancelSubscription).not.toHaveBeenCalled();
      expect(state.subscriptions[0]).toMatchObject({ pendingSyncAction: "refund_cancel" });
    });

    it("edge: a partial order_refunded on a subscription order cancels nothing and records the refunded amount", async () => {
      const { state } = createDbHarness({ subscriptionsBySql: true, subscriptions: [lsRow()] });
      const provider = lemonProvider();
      const service = new BillingService(provider as never);

      await expect(
        service.reconcileWebhookEvent(orderRefundedEvent({ status: "partial_refund", refunded_amount: 1500 })),
      ).resolves.toBe("processed");

      expect(provider.getSubscription).not.toHaveBeenCalled();
      expect(provider.cancelSubscription).not.toHaveBeenCalled();
      expect(state.updated.subscriptions).toHaveLength(0);
      expect(lastProcessedMetadata(state)).toMatchObject({ reason: "partial_refund_review", refundedAmount: 1500 });
    });

    it("edge: a partial subscription_payment_refunded cancels nothing and records the refunded amount", async () => {
      const { state } = createDbHarness({ subscriptionsBySql: true, subscriptions: [lsRow()] });
      const provider = lemonProvider();
      const service = new BillingService(provider as never);

      await expect(
        service.reconcileWebhookEvent(subscriptionPaymentRefundedEvent({ status: "partial_refund", refunded_amount: 900 })),
      ).resolves.toBe("processed");

      expect(provider.getSubscription).not.toHaveBeenCalled();
      expect(provider.cancelSubscription).not.toHaveBeenCalled();
      expect(state.updated.subscriptions).toHaveLength(0);
      expect(lastProcessedMetadata(state)).toMatchObject({ reason: "partial_refund_review", refundedAmount: 900 });
    });

    it("error: a subscription refund event with an unrecognized status is ignored without cancelling", async () => {
      const { state } = createDbHarness({ subscriptionsBySql: true, subscriptions: [lsRow()] });
      const provider = lemonProvider();
      const service = new BillingService(provider as never);

      await expect(
        service.reconcileWebhookEvent(subscriptionPaymentRefundedEvent({ status: "paid" })),
      ).resolves.toBe("ignored");
      await expect(service.reconcileWebhookEvent(orderRefundedEvent({ status: "paid" }))).resolves.toBe("ignored");

      expect(provider.cancelSubscription).not.toHaveBeenCalled();
      expect(lastProcessedMetadata(state)).toMatchObject({ reason: "refund_status_unrecognized" });
    });

    it("regression: subscription_updated takes plan and interval from variant_id over stale custom_data", async () => {
      process.env.LEMONSQUEEZY_VARIANT_PRO_ANNUAL = "444";
      const { state } = createDbHarness({
        subscriptionsBySql: true,
        organizations: [{ id: "org-1", currentPlan: "growth", billingStatus: "subscription_active" }],
        subscriptions: [lsRow()],
      });
      const service = new BillingService({} as never);

      await service.reconcileWebhookEvent(subscriptionEvent("subscription_updated", { variant_id: 444 }));

      expect(state.subscriptions[0]).toMatchObject({ planType: "pro", billingInterval: "annual" });
      expect(state.updated.organizations[0]).toMatchObject({ currentPlan: "pro" });
    });

    it("regression: a scheduled downgrade is applied once scheduledChangeEffectiveAt has passed", async () => {
      const { state } = createDbHarness({
        subscriptionsBySql: true,
        organizations: [{ id: "org-1", currentPlan: "growth", billingStatus: "subscription_active" }],
        subscriptions: [
          lsRow({
            scheduledPlanType: "starter",
            scheduledBillingInterval: "monthly",
            scheduledChangeEffectiveAt: new Date(NOW.getTime() - DAY_MS),
          }),
        ],
      });
      const service = new BillingService({} as never);

      await service.reconcileWebhookEvent(
        subscriptionEvent("subscription_updated", {}, { customData: { plan_type: "starter" } }),
      );

      expect(state.subscriptions[0]).toMatchObject({
        planType: "starter",
        scheduledPlanType: null,
        scheduledChangeEffectiveAt: null,
      });
      expect(state.updated.organizations[0]).toMatchObject({ currentPlan: "starter" });
    });

    it("regression: annual growth → monthly pro is an immediate upgrade; monthly pro → annual growth is scheduled", async () => {
      process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY = "333";
      process.env.LEMONSQUEEZY_VARIANT_GROWTH_ANNUAL = "555";

      createDbHarness({ subscriptionsBySql: true, subscriptions: [lsRow({ billingInterval: "annual" })] });
      const upgradeProvider = lemonProvider();
      await expect(
        new BillingService(upgradeProvider as never).changePlan("org-1", { planType: "pro", billingInterval: "monthly" }),
      ).resolves.toMatchObject({ scheduled: false });
      expect(upgradeProvider.updateSubscription).toHaveBeenCalledWith("sub_a", { variantId: "333", invoiceImmediately: true });

      createDbHarness({ subscriptionsBySql: true, subscriptions: [lsRow({ planType: "pro" })] });
      const downgradeProvider = lemonProvider();
      await expect(
        new BillingService(downgradeProvider as never).changePlan("org-1", { planType: "growth", billingInterval: "annual" }),
      ).resolves.toMatchObject({ scheduled: true });
      expect(downgradeProvider.updateSubscription).toHaveBeenCalledWith("sub_a", { variantId: "555", disableProrations: true });
    });

    it("regression: same-tier monthly → annual is an immediate upgrade; annual → monthly is scheduled", async () => {
      process.env.LEMONSQUEEZY_VARIANT_GROWTH_ANNUAL = "555";
      process.env.LEMONSQUEEZY_VARIANT_GROWTH_MONTHLY = "222";

      createDbHarness({ subscriptionsBySql: true, subscriptions: [lsRow()] });
      const upgradeProvider = lemonProvider();
      await expect(
        new BillingService(upgradeProvider as never).changePlan("org-1", { planType: "growth", billingInterval: "annual" }),
      ).resolves.toMatchObject({ scheduled: false });
      expect(upgradeProvider.updateSubscription).toHaveBeenCalledWith("sub_a", { variantId: "555", invoiceImmediately: true });

      createDbHarness({ subscriptionsBySql: true, subscriptions: [lsRow({ billingInterval: "annual" })] });
      const downgradeProvider = lemonProvider();
      await expect(
        new BillingService(downgradeProvider as never).changePlan("org-1", { planType: "growth", billingInterval: "monthly" }),
      ).resolves.toMatchObject({ scheduled: true });
      expect(downgradeProvider.updateSubscription).toHaveBeenCalledWith("sub_a", { variantId: "222", disableProrations: true });
    });

    it("regression: returning to active clears graceUntil", async () => {
      const { state } = createDbHarness({
        subscriptionsBySql: true,
        organizations: [{ id: "org-1", currentPlan: "growth", billingStatus: "subscription_past_due" }],
        subscriptions: [lsRow({ status: "past_due", graceUntil: new Date(NOW.getTime() + 2 * DAY_MS) })],
      });
      const service = new BillingService({} as never);

      await service.reconcileWebhookEvent(subscriptionEvent("subscription_updated", { status: "active" }));

      expect(state.subscriptions[0]).toMatchObject({ status: "active", graceUntil: null });
      expect(state.updated.organizations[0]).toMatchObject({ billingStatus: "subscription_active" });
    });

    it("regression: getBillingStatus reports unpaid as subscription_past_due and trialing as trial_active", async () => {
      createDbHarness({ subscriptionsBySql: true, subscriptions: [lsRow({ status: "unpaid", graceUntil: new Date(NOW.getTime() + DAY_MS) })] });
      await expect(new BillingService({} as never).getBillingStatus("org-1")).resolves.toMatchObject({
        billingStatus: "subscription_past_due",
        planType: "growth",
      });

      createDbHarness({ subscriptionsBySql: true, subscriptions: [lsRow({ status: "trialing" })] });
      await expect(new BillingService({} as never).getBillingStatus("org-1")).resolves.toMatchObject({
        billingStatus: "trial_active",
      });
    });

    it("regression: getBillingStatus reports the free plan once the grace period has ended", async () => {
      createDbHarness({
        subscriptionsBySql: true,
        subscriptions: [lsRow({ status: "past_due", graceUntil: new Date(NOW.getTime() - DAY_MS) })],
      });

      await expect(new BillingService({} as never).getBillingStatus("org-1")).resolves.toMatchObject({
        planType: "free",
        billingStatus: "subscription_past_due",
      });
    });

    it("regression: a full order_refunded for a subscription order cancels the LS subscription and marks pending sync refund_cancel", async () => {
      const { state } = createDbHarness({ subscriptionsBySql: true, subscriptions: [lsRow()] });
      const provider = lemonProvider();
      const service = new BillingService(provider as never);

      await expect(service.reconcileWebhookEvent(orderRefundedEvent({ status: "refunded" }))).resolves.toBe("processed");

      expect(provider.cancelSubscription).toHaveBeenCalledWith("sub_a");
      expect(state.subscriptions[0]).toMatchObject({
        pendingSyncAction: "refund_cancel",
        pendingSyncTargetPlanType: "free",
        pendingSyncTargetBillingInterval: "monthly",
      });
      expect(lastProcessedMetadata(state)).toMatchObject({ reason: "refund_cancelled_subscription" });
    });

    it("regression: a full subscription_payment_refunded cancels the invoice's subscription", async () => {
      const { state } = createDbHarness({
        subscriptionsBySql: true,
        subscriptions: [lsRow({ providerSubscriptionId: "456" })],
      });
      const provider = lemonProvider();
      const service = new BillingService(provider as never);

      await expect(
        service.reconcileWebhookEvent(subscriptionPaymentRefundedEvent({ subscription_id: 456, status: "refunded" })),
      ).resolves.toBe("processed");

      expect(provider.cancelSubscription).toHaveBeenCalledWith("456");
      expect(state.subscriptions[0]).toMatchObject({ pendingSyncAction: "refund_cancel" });
    });

    it("error: a full subscription_payment_refunded without custom_data still cancels the matched subscription", async () => {
      const { state } = createDbHarness({ subscriptionsBySql: true, subscriptions: [lsRow()] });
      const provider = lemonProvider();
      const service = new BillingService(provider as never);
      const event = subscriptionPaymentRefundedEvent({ status: "refunded" });
      delete (event.meta as { custom_data?: unknown }).custom_data;

      await expect(service.reconcileWebhookEvent(event)).resolves.toBe("processed");

      expect(provider.cancelSubscription).toHaveBeenCalledWith("sub_a");
      expect(state.subscriptions[0]).toMatchObject({ pendingSyncAction: "refund_cancel" });
      expect(lastProcessedMetadata(state)).toMatchObject({ reason: "refund_cancelled_subscription" });
    });

    it("error: a subscription_payment_refunded whose organization_id differs from the matched row is ignored", async () => {
      const { state } = createDbHarness({ subscriptionsBySql: true, subscriptions: [lsRow()] });
      const provider = lemonProvider();
      const service = new BillingService(provider as never);
      const event = subscriptionPaymentRefundedEvent({ status: "refunded" });
      event.meta.custom_data = { organization_id: "org-other" };

      await expect(service.reconcileWebhookEvent(event)).resolves.toBe("ignored");

      expect(provider.getSubscription).not.toHaveBeenCalled();
      expect(provider.cancelSubscription).not.toHaveBeenCalled();
      expect(state.updated.subscriptions).toHaveLength(0);
      expect(lastProcessedMetadata(state)).toMatchObject({ reason: "organization_mismatch" });
    });

    it("edge: first LS event for an org whose only row is provider manual inserts a new row and leaves the manual row untouched", async () => {
      const manualRow = lsRow({
        id: "manual-row",
        planType: "starter",
        status: "active",
        provider: "manual",
        providerSubscriptionId: null,
        providerOrderId: null,
      });
      const { state } = createDbHarness({
        subscriptionsBySql: true,
        organizations: [{ id: "org-1", currentPlan: "starter", billingStatus: "active_manual" }],
        subscriptions: [{ ...manualRow }],
      });
      const service = new BillingService({} as never);

      await service.reconcileWebhookEvent(subscriptionEvent("subscription_created"));

      expect(state.inserted.subscriptions).toHaveLength(1);
      expect(state.inserted.subscriptions[0]).toMatchObject({ provider: "lemonsqueezy", providerSubscriptionId: "sub_a" });
      expect(state.subscriptions.find((row) => row.id === "manual-row")).toEqual(manualRow);
    });

    it("regression: getSubscription prefers the live LS subscription over an ended one with a later currentPeriodEnd", async () => {
      createDbHarness({
        subscriptionsBySql: true,
        subscriptions: [
          lsRow({
            id: "ended-a",
            status: "expired",
            cancelled: "true",
            providerSubscriptionId: "sub_old",
            currentPeriodEnd: new Date("2027-06-01T00:00:00.000Z"),
          }),
          lsRow({ id: "live-b", status: "active", currentPeriodEnd: new Date("2026-12-01T00:00:00.000Z") }),
        ],
      });
      const service = new BillingService({} as never);

      await expect(service.getSubscription("org-1")).resolves.toMatchObject({ id: "live-b" });
    });

    it("regression: billing configuration errors name no env key", async () => {
      delete process.env.LEMONSQUEEZY_VARIANT_SMS_SEGMENT_TOPUP_25;
      const service = new BillingService(lemonProvider() as never);

      const error = await service
        .createAddonCheckout({ organizationId: "org-1", userId: "user-1", sku: "sms-segment-topup-25" })
        .then(
          () => null,
          (err: unknown) => err,
        );

      expect(error).toBeInstanceOf(ServiceUnavailableException);
      const response = (error as ServiceUnavailableException).getResponse();
      expect(response).toMatchObject({ code: "BILLING_MISCONFIGURED" });
      expect(JSON.stringify(response)).not.toContain("LEMONSQUEEZY_");
    });

    it("happy: createSubscriptionCheckout proceeds when the only subscription is expired", async () => {
      process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY = "333";
      createDbHarness({ subscriptionsBySql: true, subscriptions: [lsRow({ status: "expired", cancelled: "true" })] });
      const provider = lemonProvider();
      const service = new BillingService(provider as never);

      await expect(
        service.createSubscriptionCheckout({ organizationId: "org-1", userId: "user-1", planType: "pro", billingInterval: "monthly" }),
      ).resolves.toMatchObject({ checkoutUrl: "https://checkout.example/x" });
      expect(provider.createCheckout).toHaveBeenCalledWith(expect.objectContaining({ variantId: "333" }));
    });
  });
});
