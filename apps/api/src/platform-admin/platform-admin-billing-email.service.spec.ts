import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@tyvera/database";
import { PlatformAdminBillingEmailService } from "./platform-admin-billing-email.service";

const tables = vi.hoisted(() => ({
  deliveries: Symbol("deliveries"),
  items: Symbol("items"),
  organizations: Symbol("organizations"),
  payments: Symbol("payments"),
  requests: Symbol("requests"),
}));

vi.mock("@tyvera/database", () => ({
  getDb: vi.fn(),
  manualBillingEmailDeliveries: tables.deliveries,
  manualBillingRequestItems: tables.items,
  manualBillingRequests: tables.requests,
  manualPayments: tables.payments,
  organizations: tables.organizations,
}));

vi.mock("drizzle-orm", () => ({
  desc: vi.fn((value) => value),
  eq: vi.fn((left, right) => ({ left, right })),
}));

function createHarness(input?: {
  billingContactEmail?: string | null;
  existingDelivery?: Record<string, unknown> | null;
  providerResult?: Record<string, unknown>;
  providerError?: Error;
  enabled?: boolean;
}) {
  const state = {
    request: {
      id: "request-1",
      organizationId: "org-1",
      referenceNumber: "TYV-2026-000001",
      totalAmountPhp: 5_999,
      dueAt: null,
      createdAt: new Date("2026-06-12T00:00:00.000Z"),
    },
    organization: {
      id: "org-1",
      name: "Tyvera Clinic",
      billingContactEmail:
        input?.billingContactEmail === undefined
          ? "billing@example.com"
          : input.billingContactEmail,
    },
    item: {
      id: "item-1",
      billingRequestId: "request-1",
      sku: "pro-monthly",
      purchaseKind: "subscription",
      planType: "pro",
      billingInterval: "monthly",
      coverageStartsAt: new Date("2026-06-12T00:00:00.000Z"),
      coverageEndsAt: new Date("2026-07-12T00:00:00.000Z"),
      quantity: 1,
      units: 1,
    },
    payment: {
      id: "payment-1",
      billingRequestId: "request-1",
      amountPhp: 5_999,
      method: "gcash",
      status: "verified",
    },
    deliveries: input?.existingDelivery ? [input.existingDelivery] : [],
  };

  const select = vi.fn(() => ({
    from: (table: symbol) => ({
      where: (condition?: { right?: unknown }) => ({
        limit: async () => {
          if (table === tables.requests) return [state.request];
          if (table === tables.organizations) return [state.organization];
          if (table === tables.items) return [state.item];
          if (table === tables.payments) return [state.payment];
          if (table === tables.deliveries) {
            return state.deliveries
              .filter(
                (delivery) =>
                  !condition?.right ||
                  delivery.clientRef === condition.right,
              )
              .slice(0, 1);
          }
          return [];
        },
        orderBy: () => ({
          limit: async () => {
            if (table !== tables.deliveries) return [];
            return state.deliveries
              .filter(
                (delivery) =>
                  !condition?.right ||
                  delivery.clientRef === condition.right,
              )
              .slice(0, 1);
          },
        }),
      }),
      orderBy: () => ({
        limit: async () =>
          table === tables.items ? [state.item] : state.deliveries,
      }),
    }),
  }));
  const insert = vi.fn((table: symbol) => ({
    values: (value: Record<string, unknown>) => ({
      returning: async () => {
        if (table !== tables.deliveries) return [];
        const row = {
          id: `delivery-${state.deliveries.length + 1}`,
          attemptedAt: new Date("2026-06-12T00:00:00.000Z"),
          createdAt: new Date("2026-06-12T00:00:00.000Z"),
          updatedAt: new Date("2026-06-12T00:00:00.000Z"),
          ...value,
        };
        state.deliveries.unshift(row);
        return [row];
      },
    }),
  }));
  vi.mocked(getDb).mockReturnValue({ select, insert } as never);

  const emailProvider = {
    send: input?.providerError
      ? vi.fn(async () => {
          throw input.providerError;
        })
      : vi.fn(async () => input?.providerResult ?? {
          ok: true,
          providerMessageId: "resend-1",
        }),
  };
  const service = new PlatformAdminBillingEmailService(
    emailProvider as never,
    {
      manualBillingControlsEnabled: vi.fn(() => input?.enabled ?? true),
    } as never,
  );
  return { emailProvider, service, state };
}

describe("PlatformAdminBillingEmailService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MANUAL_PAYMENT_GCASH_NUMBER = "09171234567";
    process.env.MANUAL_PAYMENT_GCASH_ACCOUNT_NAME = "Tyvera";
  });

  it("sends payment request to billingContactEmail with a PDF attachment", async () => {
    const { emailProvider, service } = createHarness();

    await service.sendPaymentRequestEmail({
      billingRequestId: "request-1",
      mode: "automatic",
    });

    expect(emailProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "billing@example.com",
        subject: expect.stringContaining("Tyvera Payment Request"),
        attachments: [
          expect.objectContaining({
            filename: "TYV-2026-000001-pro-forma-invoice.pdf",
            contentType: "application/pdf",
            content: expect.any(Uint8Array),
          }),
        ],
      }),
    );
  });

  it("records provider message id when sent", async () => {
    const { service, state } = createHarness();

    const result = await service.sendPaymentRequestEmail({
      billingRequestId: "request-1",
      mode: "automatic",
    });

    expect(result).toMatchObject({
      status: "sent",
      providerMessageId: "resend-1",
    });
    expect(state.deliveries[0]).toMatchObject({
      status: "sent",
      providerMessageId: "resend-1",
    });
  });

  it("records skipped_missing_recipient without throwing", async () => {
    const { emailProvider, service } = createHarness({
      billingContactEmail: null,
    });

    await expect(
      service.sendPaymentRequestEmail({
        billingRequestId: "request-1",
        mode: "automatic",
      }),
    ).resolves.toMatchObject({
      status: "skipped_missing_recipient",
      recipientEmail: null,
      failureReason: "Billing contact email is missing.",
    });
    expect(emailProvider.send).not.toHaveBeenCalled();
  });

  it("records failed provider_not_configured without throwing", async () => {
    const { service } = createHarness({
      providerResult: {
        ok: false,
        transient: false,
        errorCode: "provider_not_configured",
      },
    });

    await expect(
      service.sendPaymentRequestEmail({
        billingRequestId: "request-1",
        mode: "automatic",
      }),
    ).resolves.toMatchObject({
      status: "failed",
      failureReason: "provider_not_configured",
    });
  });

  it("records unexpected_provider_error when the provider throws", async () => {
    const { service } = createHarness({
      providerError: new Error("secret provider response"),
    });

    await expect(
      service.sendPaymentRequestEmail({
        billingRequestId: "request-1",
        mode: "automatic",
      }),
    ).resolves.toMatchObject({
      status: "failed",
      failureReason: "unexpected_provider_error",
    });
  });

  it("uses deterministic automatic request clientRef", async () => {
    const { emailProvider, service } = createHarness();

    await service.sendPaymentRequestEmail({
      billingRequestId: "request-1",
      mode: "automatic",
    });

    expect(emailProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        clientRef: "manual-billing-payment-request:request-1:automatic",
      }),
    );
  });

  it("does not duplicate automatic request send", async () => {
    const existing = {
      id: "delivery-existing",
      clientRef: "manual-billing-payment-request:request-1:automatic",
      status: "sent",
    };
    const { emailProvider, service } = createHarness({
      existingDelivery: existing,
    });

    await expect(
      service.sendPaymentRequestEmail({
        billingRequestId: "request-1",
        mode: "automatic",
      }),
    ).resolves.toMatchObject(existing);
    expect(emailProvider.send).not.toHaveBeenCalled();
  });

  it("creates a distinct row for manual resend", async () => {
    const { service, state } = createHarness();

    const first = await service.sendPaymentRequestEmail({
      billingRequestId: "request-1",
      attemptedByPlatformAdminId: "admin-1",
      mode: "manual_resend",
    });
    const second = await service.sendPaymentRequestEmail({
      billingRequestId: "request-1",
      attemptedByPlatformAdminId: "admin-1",
      mode: "manual_resend",
    });

    expect(first.clientRef).not.toBe(second.clientRef);
    expect(state.deliveries).toHaveLength(2);
  });

  it("sends acknowledgment after verified payment without an invoice attachment", async () => {
    const { emailProvider, service } = createHarness();

    await service.sendPaymentAcknowledgmentEmail({
      billingRequestId: "request-1",
      manualPaymentId: "payment-1",
      mode: "automatic",
    });

    expect(emailProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("Tyvera Payment Acknowledgment"),
        clientRef:
          "manual-billing-payment-acknowledgment:payment-1:automatic",
      }),
    );
    expect(emailProvider.send).toHaveBeenCalledWith(
      expect.not.objectContaining({
        attachments: expect.anything(),
      }),
    );
  });

  it("does not duplicate automatic acknowledgment send", async () => {
    const existing = {
      id: "delivery-existing",
      clientRef:
        "manual-billing-payment-acknowledgment:payment-1:automatic",
      status: "sent",
    };
    const { emailProvider, service } = createHarness({
      existingDelivery: existing,
    });

    await expect(
      service.sendPaymentAcknowledgmentEmail({
        billingRequestId: "request-1",
        manualPaymentId: "payment-1",
        mode: "automatic",
      }),
    ).resolves.toMatchObject(existing);
    expect(emailProvider.send).not.toHaveBeenCalled();
  });

  it("records attemptedByPlatformAdminId for manual resend", async () => {
    const { service } = createHarness();

    await expect(
      service.sendPaymentRequestEmail({
        billingRequestId: "request-1",
        attemptedByPlatformAdminId: "admin-1",
        mode: "manual_resend",
      }),
    ).resolves.toMatchObject({
      attemptedByPlatformAdminId: "admin-1",
    });
  });

  it("records skipped_disabled for explicit resend", async () => {
    const { emailProvider, service } = createHarness({ enabled: false });

    await expect(
      service.sendPaymentRequestEmail({
        billingRequestId: "request-1",
        attemptedByPlatformAdminId: "admin-1",
        mode: "manual_resend",
      }),
    ).resolves.toMatchObject({
      status: "skipped_disabled",
      failureReason: "Manual billing controls are disabled.",
    });
    expect(emailProvider.send).not.toHaveBeenCalled();
  });
});
