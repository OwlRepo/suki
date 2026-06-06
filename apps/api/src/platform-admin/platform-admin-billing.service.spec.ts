import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDb,
  manualBillingFulfillments,
  manualBillingRequestItems,
  manualBillingRequests,
  manualPayments,
  organizations,
  platformAdminAuditLogs,
  smsCredits,
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
    "PAYMENT_VERIFY",
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
}) {
  const state = {
    organization: {
      id: "org-1",
      name: "Tyvera Clinic",
      currentPlan: "starter",
      billingStatus: "subscription_active",
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
    smsLedger: input?.smsLedger ?? {
      organizationId: "org-1",
      month: "2026-06",
      included: 300,
      addon: 0,
      used: 20,
    },
    inserted: {
      requests: [] as Array<Record<string, unknown>>,
      items: [] as Array<Record<string, unknown>>,
      payments: [] as Array<Record<string, unknown>>,
      fulfillments: [] as Array<Record<string, unknown>>,
      audit: [] as Array<Record<string, unknown>>,
    },
    updated: {
      requests: [] as Array<Record<string, unknown>>,
      payments: [] as Array<Record<string, unknown>>,
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
          if (table === smsCredits) return [state.smsLedger];
          return [];
        },
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
      },
    }),
  }));

  const tx = { select, insert, update };
  vi.mocked(getDb).mockReturnValue({
    select,
    insert,
    update,
    transaction: vi.fn(async (callback: (trx: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  } as never);

  return state;
}

function createService(overrides?: {
  smsGrant?: { grant: ReturnType<typeof vi.fn> };
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
});
