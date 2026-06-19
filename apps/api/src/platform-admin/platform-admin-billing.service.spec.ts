import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDb,
  manualBillingEmailDeliveries,
  manualBillingFulfillments,
  manualBillingRequestItems,
  manualBillingRequests,
  manualPayments,
  organizations,
  platformAdminAuditLogs,
  smsCredits,
  subscriptions,
  verifiedOnlineBookingCredits,
} from "@tyvera/database";
import type { ActivePlatformAdmin } from "./platform-admin.service";
import { PlatformAdminBillingService } from "./platform-admin-billing.service";

vi.mock("@tyvera/database", async () => {
  const actual = await vi.importActual<typeof import("@tyvera/database")>(
    "@tyvera/database",
  );
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

const financeAdmin: ActivePlatformAdmin = {
  id: "platform-admin-finance",
  userId: "user-finance",
  roleCodes: ["FINANCE"],
  permissions: new Set([
    "PLATFORM_ADMIN_ACCESS",
    "BILLING_REQUEST_CREATE",
    "PAYMENT_RECORD",
    "PAYMENT_VERIFY",
    "BUSINESS_UPDATE",
    "SUBSCRIPTION_VIEW",
    "SUBSCRIPTION_CREATE",
    "SUBSCRIPTION_RENEW",
    "SUBSCRIPTION_CHANGE_PLAN",
    "SUBSCRIPTION_MARK_PAST_DUE",
    "SUBSCRIPTION_SET_GRACE",
    "SUBSCRIPTION_SUSPEND",
    "SUBSCRIPTION_REACTIVATE",
    "SUBSCRIPTION_CANCEL",
    "SMS_CREDIT_GRANT_PROMOTIONAL",
    "SMS_CREDIT_APPLY_CORRECTION",
  ]),
};

function createBillingHarness(input?: {
  request?: Record<string, unknown>;
  item?: Record<string, unknown>;
  payment?: Record<string, unknown>;
  fulfillment?: Record<string, unknown> | null;
  smsLedger?: Record<string, unknown>;
  organization?: Record<string, unknown>;
  subscription?: Record<string, unknown> | null;
  verifiedLedger?: Record<string, unknown> | null;
  emailDeliveries?: Array<Record<string, unknown>>;
}) {
  const state = {
    organization: input?.organization ?? {
      id: "org-1",
      name: "Tyvera Clinic",
      currentPlan: "starter",
      billingStatus: "active_manual",
      accessEndsAt: new Date("2026-07-01T00:00:00.000Z"),
    },
    request: input?.request ?? {
      id: "billing-request-1",
      organizationId: "org-1",
      referenceNumber: "TYV-2026-000001",
      status: "payment_reported",
      totalAmountPhp: 599,
    },
    item: input?.item ?? {
      id: "item-1",
      billingRequestId: "billing-request-1",
      sku: "sms-segment-topup-25",
      purchaseKind: "sms_segment_topup",
      units: 25,
      unitPricePhp: 599,
      quantity: 1,
      totalAmountPhp: 599,
    },
    payment: input?.payment ?? {
      id: "payment-1",
      billingRequestId: "billing-request-1",
      amountPhp: 599,
      status: "pending",
      method: "gcash",
    },
    fulfillment: input?.fulfillment ?? null,
    subscription:
      input?.subscription === undefined
        ? {
            id: "subscription-1",
            organizationId: "org-1",
            planType: "starter",
            status: "active",
            provider: "manual",
            billingInterval: "monthly",
            currentPeriodStart: new Date("2026-06-01T00:00:00.000Z"),
            currentPeriodEnd: new Date("2026-07-01T00:00:00.000Z"),
            renewsAt: new Date("2026-07-01T00:00:00.000Z"),
            planPricePhp: 999,
          }
        : input.subscription,
    smsLedger: input?.smsLedger ?? {
      organizationId: "org-1",
      month: "2026-06",
      included: 300,
      addon: 0,
      used: 20,
    },
    verifiedLedger: input?.verifiedLedger ?? {
      organizationId: "org-1",
      month: "2026-07",
      includedGranted: 5,
      addonGranted: 0,
      used: 2,
      sourcePlan: "free",
    },
    emailDeliveries: input?.emailDeliveries ?? [],
    inTransaction: false,
    inserted: {
      requests: [] as Array<Record<string, unknown>>,
      items: [] as Array<Record<string, unknown>>,
      payments: [] as Array<Record<string, unknown>>,
      fulfillments: [] as Array<Record<string, unknown>>,
      subscriptions: [] as Array<Record<string, unknown>>,
      verifiedCredits: [] as Array<Record<string, unknown>>,
      audit: [] as Array<Record<string, unknown>>,
    },
    updated: {
      requests: [] as Array<Record<string, unknown>>,
      payments: [] as Array<Record<string, unknown>>,
      organizations: [] as Array<Record<string, unknown>>,
      subscriptions: [] as Array<Record<string, unknown>>,
      verifiedCredits: [] as Array<Record<string, unknown>>,
    },
  };

  const select = vi.fn(() => ({
    from: (table: unknown) => ({
      where: () => ({
        limit: async () => {
          if (table === organizations) return [state.organization];
          if (table === manualBillingRequests) return [state.request];
          if (table === manualBillingRequestItems) return [state.item];
          if (table === manualPayments) return [state.payment];
          if (table === manualBillingFulfillments) {
            return state.fulfillment ? [state.fulfillment] : [];
          }
          if (table === manualBillingEmailDeliveries) {
            return state.emailDeliveries;
          }
          if (table === smsCredits) return [state.smsLedger];
          if (table === subscriptions) {
            return state.subscription ? [state.subscription] : [];
          }
          if (table === verifiedOnlineBookingCredits) {
            return state.verifiedLedger ? [state.verifiedLedger] : [];
          }
          return [];
        },
        orderBy: () => ({
          limit: async () => {
            if (table === manualBillingEmailDeliveries) {
              return state.emailDeliveries;
            }
            if (table === subscriptions) {
              return state.subscription ? [state.subscription] : [];
            }
            return [];
          },
        }),
      }),
      orderBy: () => ({
        limit: async () => {
          if (table === manualBillingRequests) return [state.request];
          return [];
        },
      }),
    }),
  }));

  const insert = vi.fn((table: unknown) => ({
    values: (value: Record<string, unknown>) => ({
      returning: async () => {
        if (table === manualBillingRequests) {
          const row = {
            id: "billing-request-1",
            referenceNumber: "TYV-2026-000001",
            status: "awaiting_payment",
            ...value,
          };
          state.inserted.requests.push(row);
          state.request = row;
          return [row];
        }
        if (table === manualBillingRequestItems) {
          const row = { id: "item-1", ...value };
          state.inserted.items.push(row);
          state.item = row;
          return [row];
        }
        if (table === manualPayments) {
          const row = { id: "payment-1", status: "pending", ...value };
          state.inserted.payments.push(row);
          state.payment = row;
          return [row];
        }
        if (table === manualBillingFulfillments) {
          const row = { id: "fulfillment-1", ...value };
          state.inserted.fulfillments.push(row);
          state.fulfillment = row;
          return [row];
        }
        if (table === subscriptions) {
          const row = { id: "subscription-1", ...value };
          state.inserted.subscriptions.push(row);
          state.subscription = row;
          return [row];
        }
        if (table === verifiedOnlineBookingCredits) {
          const row = { id: "verified-credit-1", ...value };
          state.inserted.verifiedCredits.push(row);
          state.verifiedLedger = row;
          return [row];
        }
        if (table === platformAdminAuditLogs) {
          state.inserted.audit.push(value);
          return [value];
        }
        return [value];
      },
      then: (
        resolve: (value?: unknown) => unknown,
        reject: (reason?: unknown) => unknown,
      ) => {
        if (table === platformAdminAuditLogs) state.inserted.audit.push(value);
        return Promise.resolve(undefined).then(resolve, reject);
      },
    }),
  }));

  const update = vi.fn((table: unknown) => ({
    set: (value: Record<string, unknown>) => ({
      where: async () => {
        if (table === manualBillingRequests) {
          state.updated.requests.push(value);
          state.request = { ...state.request, ...value };
        }
        if (table === manualPayments) {
          state.updated.payments.push(value);
          state.payment = { ...state.payment, ...value };
        }
        if (table === organizations) {
          state.updated.organizations.push(value);
          state.organization = { ...state.organization, ...value };
        }
        if (table === subscriptions) {
          state.updated.subscriptions.push(value);
          state.subscription = { ...state.subscription, ...value };
        }
        if (table === verifiedOnlineBookingCredits) {
          state.updated.verifiedCredits.push(value);
          state.verifiedLedger = { ...state.verifiedLedger, ...value };
        }
      },
    }),
  }));

  const tx = { select, insert, update };
  vi.mocked(getDb).mockReturnValue({
    select,
    insert,
    update,
    transaction: vi.fn(async (callback: (trx: typeof tx) => Promise<unknown>) =>
      {
        state.inTransaction = true;
        try {
          return await callback(tx);
        } finally {
          state.inTransaction = false;
        }
      },
    ),
  } as never);

  return state;
}

function createService(overrides?: {
  smsGrant?: { grant: ReturnType<typeof vi.fn> };
  manualBillingEnabled?: boolean;
  billingEmails?: {
    sendPaymentRequestEmail: ReturnType<typeof vi.fn>;
    sendPaymentAcknowledgmentEmail: ReturnType<typeof vi.fn>;
  };
}) {
  return new PlatformAdminBillingService(
    (overrides?.smsGrant ??
      ({
        grant: vi.fn(async () => ({
          alreadyGranted: false,
          ledgerBefore: { addon: 0, used: 20 },
          ledgerAfter: { addon: 25, used: 20 },
        })),
      })) as never,
    {
      grant: vi.fn(async () => ({
        alreadyGranted: false,
        ledgerBefore: { addonGranted: 0, used: 0 },
        ledgerAfter: { addonGranted: 25, used: 0 },
      })),
    } as never,
    {
      manualBillingControlsEnabled: vi.fn(
        () => overrides?.manualBillingEnabled ?? true,
      ),
    } as never,
    (overrides?.billingEmails ?? {
      sendPaymentRequestEmail: vi.fn(async () => ({
        id: "delivery-request",
        status: "sent",
        recipientEmail: "billing@example.com",
      })),
      sendPaymentAcknowledgmentEmail: vi.fn(async () => ({
        id: "delivery-acknowledgment",
        status: "sent",
        recipientEmail: "billing@example.com",
      })),
    }) as never,
    {} as never,
  );
}

describe("PlatformAdminBillingService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T10:00:00.000Z"));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a manual billing request with a snapshot of SKU units and price", async () => {
    const state = createBillingHarness({
      request: {
        id: "previous-request",
        referenceNumber: "TYV-2026-000000",
        status: "awaiting_payment",
      },
    });
    const service = createService();

    const result = await service.createBillingRequest(financeAdmin, {
      organizationId: "org-1",
      sku: "sms-segment-topup-25",
      quantity: 2,
      dueAt: null,
      notes: "Walk-in GCash top-up",
    });

    expect(state.inserted.requests[0]).toMatchObject({
      organizationId: "org-1",
      referenceNumber: "TYV-2026-000001",
      status: "awaiting_payment",
      totalAmountPhp: 1198,
      createdByPlatformAdminId: "platform-admin-finance",
    });
    expect(state.inserted.items[0]).toMatchObject({
      sku: "sms-segment-topup-25",
      purchaseKind: "sms_segment_topup",
      units: 25,
      unitPricePhp: 599,
      quantity: 2,
      totalAmountPhp: 1198,
    });
    expect(state.inserted.audit[0]).toMatchObject({
      action: "manual_billing_request.created",
      organizationId: "org-1",
    });
    expect(result.paymentInstructions.copyText).toContain("TYV-2026-000001");
    expect(result.paymentInstructions.copyText).toContain("Amount: ₱1,198");
  });

  it("creates a monthly starter manual subscription request with canonical snapshot", async () => {
    const state = createBillingHarness({
      request: {
        id: "previous-request",
        referenceNumber: "TYV-2026-000000",
        status: "awaiting_payment",
      },
    });
    const service = createService();

    await service.createBillingRequest(financeAdmin, {
      organizationId: "org-1",
      sku: "starter-monthly",
      quantity: 1,
      notes: "Founder-led activation",
    });

    expect(state.inserted.items[0]).toMatchObject({
      sku: "starter-monthly",
      purchaseKind: "subscription",
      units: 1,
      unitPricePhp: 999,
      quantity: 1,
      totalAmountPhp: 999,
      planType: "starter",
      billingInterval: "monthly",
      coverageStartsAt: new Date("2026-07-01T00:00:00.000Z"),
      coverageEndsAt: new Date("2026-08-01T00:00:00.000Z"),
    });
  });

  it("returns sent email delivery after request creation and sends after commit", async () => {
    const state = createBillingHarness({
      request: {
        id: "previous-request",
        referenceNumber: "TYV-2026-000000",
        status: "awaiting_payment",
      },
    });
    const billingEmails = {
      sendPaymentRequestEmail: vi.fn(async () => {
        expect(state.inTransaction).toBe(false);
        return {
          id: "delivery-request",
          status: "sent",
          recipientEmail: "billing@example.com",
        };
      }),
      sendPaymentAcknowledgmentEmail: vi.fn(),
    };
    const service = createService({ billingEmails });

    const result = await service.createBillingRequest(financeAdmin, {
      organizationId: "org-1",
      sku: "starter-monthly",
      quantity: 1,
    });

    expect(billingEmails.sendPaymentRequestEmail).toHaveBeenCalledWith({
      billingRequestId: "billing-request-1",
      attemptedByPlatformAdminId: "platform-admin-finance",
      mode: "automatic",
    });
    expect(result.emailDelivery).toMatchObject({
      status: "sent",
      recipientEmail: "billing@example.com",
    });
  });

  it("returns failed email delivery without rolling back request", async () => {
    const state = createBillingHarness({
      request: {
        id: "previous-request",
        referenceNumber: "TYV-2026-000000",
        status: "awaiting_payment",
      },
    });
    const service = createService({
      billingEmails: {
        sendPaymentRequestEmail: vi.fn(async () => ({
          id: "delivery-request",
          status: "failed",
          failureReason: "provider_transient",
        })),
        sendPaymentAcknowledgmentEmail: vi.fn(),
      },
    });

    const result = await service.createBillingRequest(financeAdmin, {
      organizationId: "org-1",
      sku: "starter-monthly",
      quantity: 1,
    });

    expect(state.inserted.requests).toHaveLength(1);
    expect(result.billingRequest.referenceNumber).toBe("TYV-2026-000001");
    expect(result.emailDelivery).toMatchObject({
      status: "failed",
      failureReason: "provider_transient",
    });
  });

  it("returns a stable failed delivery shape when the email subsystem throws", async () => {
    const state = createBillingHarness({
      request: {
        id: "previous-request",
        referenceNumber: "TYV-2026-000000",
        status: "awaiting_payment",
      },
    });
    const service = createService({
      billingEmails: {
        sendPaymentRequestEmail: vi.fn(async () => {
          throw new Error("delivery persistence unavailable");
        }),
        sendPaymentAcknowledgmentEmail: vi.fn(),
      },
    });

    const result = await service.createBillingRequest(financeAdmin, {
      organizationId: "org-1",
      sku: "starter-monthly",
      quantity: 1,
    });

    expect(state.inserted.requests).toHaveLength(1);
    expect(result.emailDelivery).toMatchObject({
      billingRequestId: "billing-request-1",
      status: "failed",
      failureReason: "unexpected_provider_error",
    });
    expect(result.emailDelivery.id).toMatch(/^unpersisted:/);
  });

  it("uses subscription-specific copy wording", async () => {
    createBillingHarness({
      request: {
        id: "previous-request",
        referenceNumber: "TYV-2026-000000",
        status: "awaiting_payment",
      },
    });
    const service = createService();

    const result = await service.createBillingRequest(financeAdmin, {
      organizationId: "org-1",
      sku: "starter-monthly",
      quantity: 1,
    });

    expect(result.paymentInstructions.copyText).toContain(
      "Your Tyvera subscription payment request is ready.",
    );
    expect(result.paymentInstructions.copyText).toContain(
      "activate your Tyvera subscription",
    );
    expect(result.paymentInstructions.copyText).not.toContain(
      "top-up request",
    );
  });

  it("preserves add-on top-up copy wording", async () => {
    createBillingHarness({
      request: {
        id: "previous-request",
        referenceNumber: "TYV-2026-000000",
        status: "awaiting_payment",
      },
    });
    const service = createService();

    const result = await service.createBillingRequest(financeAdmin, {
      organizationId: "org-1",
      sku: "sms-segment-topup-25",
      quantity: 1,
    });

    expect(result.paymentInstructions.copyText).toContain(
      "Your Tyvera top-up request is ready.",
    );
    expect(result.paymentInstructions.copyText).toContain(
      "apply your credits",
    );
  });

  it("rejects subscription quantity greater than one", async () => {
    createBillingHarness();
    const service = createService();

    await expect(
      service.createBillingRequest(financeAdmin, {
        organizationId: "org-1",
        sku: "starter-monthly",
        quantity: 2,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("records a manual payment and returns the updated billing request detail", async () => {
    const state = createBillingHarness({
      request: {
        id: "billing-request-1",
        organizationId: "org-1",
        referenceNumber: "TYV-2026-000001",
        status: "awaiting_payment",
        totalAmountPhp: 599,
      },
    });
    const service = createService();

    const result = await service.recordManualPayment(
      financeAdmin,
      "billing-request-1",
      {
        method: "gcash",
        amountPhp: 599,
        externalReference: "TYV-2026-000003",
        notes: "paid top-up",
      },
    );

    expect(state.inserted.payments[0]).toMatchObject({
      billingRequestId: "billing-request-1",
      method: "gcash",
      amountPhp: 599,
      status: "pending",
      externalReference: "TYV-2026-000003",
      notes: "paid top-up",
      recordedByPlatformAdminId: "platform-admin-finance",
    });
    expect(state.updated.requests[0]).toMatchObject({
      status: "payment_reported",
    });
    expect(result).toMatchObject({
      id: "billing-request-1",
      status: "payment_reported",
      totalAmountPhp: 599,
      payments: [
        expect.objectContaining({
          id: "payment-1",
          amountPhp: 599,
          status: "pending",
          method: "gcash",
        }),
      ],
    });
  });

  it("fulfills an exact manual payment once and marks the request paid", async () => {
    const state = createBillingHarness();
    const smsGrant = { grant: vi.fn(async () => ({ alreadyGranted: false })) };
    const service = createService({ smsGrant });

    await service.confirmAndFulfillManualPayment(financeAdmin, "payment-1");

    expect(smsGrant.grant).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        units: 25,
        pricePhp: 599,
        source: "manual_payment",
        sourceReference: "manual-payment:payment-1:item-1",
      }),
      expect.anything(),
    );
    expect(state.inserted.fulfillments[0]).toMatchObject({
      billingRequestItemId: "item-1",
      manualPaymentId: "payment-1",
      units: 25,
      purchaseKind: "sms_segment_topup",
    });
    expect(state.updated.payments[0]).toMatchObject({ status: "verified" });
    expect(state.updated.requests[0]).toMatchObject({
      status: "paid_and_fulfilled",
    });
  });

  it("fulfills payment even when acknowledgment email fails", async () => {
    const state = createBillingHarness();
    const billingEmails = {
      sendPaymentRequestEmail: vi.fn(),
      sendPaymentAcknowledgmentEmail: vi.fn(async () => {
        expect(state.inTransaction).toBe(false);
        return {
          id: "delivery-acknowledgment",
          status: "failed",
          failureReason: "provider_rejected",
        };
      }),
    };
    const service = createService({ billingEmails });

    const result = await service.confirmAndFulfillManualPayment(
      financeAdmin,
      "payment-1",
    );

    expect(state.inserted.fulfillments).toHaveLength(1);
    expect(state.updated.payments[0]).toMatchObject({ status: "verified" });
    expect(state.updated.requests[0]).toMatchObject({
      status: "paid_and_fulfilled",
    });
    expect(result.latestEmailDelivery).toMatchObject({
      status: "failed",
      failureReason: "provider_rejected",
    });
  });

  it("serializes email delivery history", async () => {
    createBillingHarness({
      emailDeliveries: [
        {
          id: "delivery-request",
          kind: "payment_request",
          status: "sent",
          attemptedAt: new Date("2026-06-12T00:00:00.000Z"),
        },
        {
          id: "delivery-ack",
          kind: "payment_acknowledgment",
          status: "failed",
          attemptedAt: new Date("2026-06-13T00:00:00.000Z"),
        },
      ],
    });
    const service = createService();

    const result = await service.getBillingRequest("billing-request-1");

    expect(result.emailDeliveries).toHaveLength(2);
    expect(result.latestPaymentRequestEmailDelivery).toMatchObject({
      id: "delivery-request",
    });
    expect(result.latestPaymentAcknowledgmentEmailDelivery).toMatchObject({
      id: "delivery-ack",
    });
  });

  it("fulfills an exact starter subscription payment and activates manual billing", async () => {
    const state = createBillingHarness({
      organization: {
        id: "org-1",
        name: "Tyvera Clinic",
        currentPlan: "free",
        billingStatus: "free_active",
        accessEndsAt: null,
      },
      subscription: null,
      request: {
        id: "billing-request-1",
        organizationId: "org-1",
        referenceNumber: "TYV-2026-000001",
        status: "payment_reported",
        totalAmountPhp: 999,
      },
      item: {
        id: "item-1",
        billingRequestId: "billing-request-1",
        sku: "starter-monthly",
        purchaseKind: "subscription",
        units: 1,
        unitPricePhp: 999,
        quantity: 1,
        totalAmountPhp: 999,
        planType: "starter",
        billingInterval: "monthly",
        coverageStartsAt: new Date("2026-06-07T10:00:00.000Z"),
        coverageEndsAt: new Date("2026-07-07T10:00:00.000Z"),
      },
      payment: {
        id: "payment-1",
        billingRequestId: "billing-request-1",
        amountPhp: 999,
        status: "pending",
        method: "gcash",
      },
    });
    const service = createService();

    await service.confirmAndFulfillManualPayment(financeAdmin, "payment-1");

    expect(state.inserted.subscriptions[0]).toMatchObject({
      planType: "starter",
      status: "active",
      provider: "manual",
      billingInterval: "monthly",
      planPricePhp: 999,
    });
    expect(state.updated.organizations[0]).toMatchObject({
      currentPlan: "starter",
      billingStatus: "active_manual",
      billingPausedAt: null,
      accessEndsAt: new Date("2026-07-07T10:00:00.000Z"),
      nextBillingDueAt: new Date("2026-07-07T10:00:00.000Z"),
    });
  });

  it("rejects manual fulfillment for a Lemon Squeezy managed subscription", async () => {
    createBillingHarness({
      subscription: {
        id: "subscription-lemon",
        organizationId: "org-1",
        provider: "lemonsqueezy",
        currentPeriodEnd: new Date("2026-07-01T00:00:00.000Z"),
      },
      request: {
        id: "billing-request-1",
        organizationId: "org-1",
        status: "payment_reported",
        totalAmountPhp: 999,
      },
      item: {
        id: "item-1",
        billingRequestId: "billing-request-1",
        purchaseKind: "subscription",
        totalAmountPhp: 999,
        quantity: 1,
        units: 1,
        planType: "starter",
        billingInterval: "monthly",
        coverageStartsAt: new Date("2026-07-01T00:00:00.000Z"),
        coverageEndsAt: new Date("2026-08-01T00:00:00.000Z"),
      },
      payment: {
        id: "payment-1",
        billingRequestId: "billing-request-1",
        amountPhp: 999,
        status: "pending",
      },
    });
    const service = createService();

    await expect(
      service.confirmAndFulfillManualPayment(financeAdmin, "payment-1"),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "PROVIDER_MANAGED_SUBSCRIPTION",
      }),
    });
  });

  it("extends active manual renewal from the future access end", async () => {
    const state = createBillingHarness({
      request: {
        id: "previous-request",
        referenceNumber: "TYV-2026-000000",
      },
    });
    const service = createService();

    await service.createBillingRequest(financeAdmin, {
      organizationId: "org-1",
      sku: "growth-monthly",
      quantity: 1,
    });

    expect(state.inserted.items[0]).toMatchObject({
      coverageStartsAt: new Date("2026-07-01T00:00:00.000Z"),
      coverageEndsAt: new Date("2026-08-01T00:00:00.000Z"),
    });
  });

  it("starts an expired renewal immediately", async () => {
    const state = createBillingHarness({
      organization: {
        id: "org-1",
        name: "Tyvera Clinic",
        currentPlan: "starter",
        billingStatus: "past_due_manual",
        accessEndsAt: new Date("2026-06-01T00:00:00.000Z"),
      },
      request: {
        id: "previous-request",
        referenceNumber: "TYV-2026-000000",
      },
    });
    const service = createService();

    await service.createBillingRequest(financeAdmin, {
      organizationId: "org-1",
      sku: "starter-monthly",
      quantity: 1,
    });

    expect(state.inserted.items[0]).toMatchObject({
      coverageStartsAt: new Date("2026-06-07T10:00:00.000Z"),
      coverageEndsAt: new Date("2026-07-07T10:00:00.000Z"),
    });
  });

  it.each([
    ["underpayment", 598],
    ["overpayment", 600],
  ])("rejects %s without creating fulfillment", async (_label, amountPhp) => {
    const state = createBillingHarness({
      payment: {
        id: "payment-1",
        billingRequestId: "billing-request-1",
        amountPhp,
        status: "pending",
        method: "gcash",
      },
    });
    const service = createService();

    await expect(
      service.confirmAndFulfillManualPayment(financeAdmin, "payment-1"),
    ).rejects.toMatchObject({
      response: {
        code: "PAYMENT_AMOUNT_MISMATCH",
        expectedAmountPhp: 599,
        receivedAmountPhp: amountPhp,
      },
    });
    expect(state.inserted.fulfillments).toHaveLength(0);
  });

  it("rejects repeated confirmation without double-crediting", async () => {
    createBillingHarness({
      fulfillment: {
        id: "fulfillment-1",
        billingRequestItemId: "item-1",
        manualPaymentId: "payment-1",
      },
    });
    const smsGrant = { grant: vi.fn() };
    const service = createService({ smsGrant });

    await expect(
      service.confirmAndFulfillManualPayment(financeAdmin, "payment-1"),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(smsGrant.grant).not.toHaveBeenCalled();
  });

  it("applies promotional grants and blocks corrections that would overdraw credits", async () => {
    createBillingHarness();
    const smsGrant = { grant: vi.fn(async () => ({ alreadyGranted: false })) };
    const service = createService({ smsGrant });

    await service.adjustSmsCredits(financeAdmin, "org-1", {
      type: "promotional_grant",
      units: 10,
      reason: "Launch credit",
    });

    expect(smsGrant.grant).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "admin_adjustment",
        units: 10,
        metadata: expect.objectContaining({ reason: "Launch credit" }),
      }),
      expect.anything(),
    );

    await expect(
      service.adjustSmsCredits(financeAdmin, "org-1", {
        type: "admin_correction",
        units: -500,
        reason: "Correction",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("denies payment confirmation to support admins without PAYMENT_VERIFY", async () => {
    createBillingHarness();
    const supportAdmin: ActivePlatformAdmin = {
      ...financeAdmin,
      id: "platform-admin-support",
      roleCodes: ["SUPPORT"],
      permissions: new Set(["PLATFORM_ADMIN_ACCESS", "BUSINESS_VIEW"]),
    };
    const service = createService();

    await expect(
      service.confirmAndFulfillManualPayment(supportAdmin, "payment-1"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("returns MANUAL_BILLING_DISABLED when manual controls are disabled", async () => {
    createBillingHarness();
    const service = createService({ manualBillingEnabled: false });

    await expect(
      service.createBillingRequest(financeAdmin, {
        organizationId: "org-1",
        sku: "starter-monthly",
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(
      service.createBillingRequest(financeAdmin, {
        organizationId: "org-1",
        sku: "starter-monthly",
        quantity: 1,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "MANUAL_BILLING_DISABLED" }),
    });
  });

  it("updates billing contact and writes an audit log", async () => {
    const state = createBillingHarness();
    const service = createService();

    await service.updateOrganizationBillingContact(financeAdmin, "org-1", {
      billingContactName: "Ana Reyes",
      billingContactMobile: "+639171234567",
      billingContactEmail: "ana@example.com",
      preferredPaymentMethod: "gcash",
    });

    expect(state.updated.organizations[0]).toMatchObject({
      billingContactName: "Ana Reyes",
      billingContactMobile: "+639171234567",
      billingContactEmail: "ana@example.com",
      preferredPaymentMethod: "gcash",
    });
    expect(state.inserted.audit.at(-1)).toMatchObject({
      action: "organization.billing_contact.updated",
    });
  });

  it("rejects invalid optional Philippine mobile billing contact", async () => {
    createBillingHarness();
    const service = createService();

    await expect(
      service.updateOrganizationBillingContact(financeAdmin, "org-1", {
        billingContactMobile: "09171234567",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ["active_manual", "mark_past_due", "past_due_manual"],
    ["past_due_manual", "set_grace_until", "past_due_manual"],
    ["past_due_manual", "suspend", "suspended"],
    ["suspended", "reactivate", "active_manual"],
    ["active_manual", "cancel", "cancelled_manual"],
  ] as const)(
    "handles %s lifecycle action %s",
    async (billingStatus, action, expectedStatus) => {
      const state = createBillingHarness({
        organization: {
          id: "org-1",
          name: "Tyvera Clinic",
          currentPlan: "starter",
          billingStatus,
          accessEndsAt: new Date("2026-07-01T00:00:00.000Z"),
        },
      });
      const service = createService();

      await service.updateManualSubscriptionStatus(financeAdmin, "org-1", {
        action,
        graceUntil:
          action === "set_grace_until"
            ? "2026-06-20T00:00:00.000Z"
            : null,
        reason: "Founder approved",
      });

      expect(state.updated.organizations.at(-1)).toMatchObject({
        billingStatus: expectedStatus,
      });
      expect(state.inserted.audit.at(-1)).toMatchObject({
        action: `manual_subscription.${action}`,
      });
    },
  );

  it("rejects unsupported lifecycle transitions", async () => {
    createBillingHarness({
      organization: {
        id: "org-1",
        name: "Tyvera Clinic",
        currentPlan: "free",
        billingStatus: "free_active",
        accessEndsAt: null,
      },
      subscription: null,
    });
    const service = createService();

    await expect(
      service.updateManualSubscriptionStatus(financeAdmin, "org-1", {
        action: "suspend",
        reason: "Invalid transition",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
