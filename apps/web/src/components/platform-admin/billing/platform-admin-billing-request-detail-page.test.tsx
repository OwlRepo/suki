import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformAdminBillingRequestDetailPage } from "./platform-admin-billing-request-detail-page";
import {
  confirmManualPaymentAndFulfill,
  getPlatformAdminBillingRequest,
  sendPlatformAdminPaymentAcknowledgmentEmail,
  sendPlatformAdminPaymentRequestEmail,
  type BillingRequestDetail,
} from "./platform-admin-billing.api";

vi.mock("./platform-admin-billing.api", () => ({
  confirmManualPaymentAndFulfill: vi.fn(),
  getPlatformAdminBillingRequest: vi.fn(),
  recordManualPayment: vi.fn(),
  rejectManualPayment: vi.fn(),
  sendPlatformAdminPaymentAcknowledgmentEmail: vi.fn(),
  sendPlatformAdminPaymentRequestEmail: vi.fn(),
  voidBillingRequest: vi.fn(),
}));

const billingRequest = {
  id: "billing-request-1",
  referenceNumber: "TYV-2026-000001",
  organizationId: "org-1",
  organizationName: "Tyvera Clinic",
  status: "payment_reported",
  totalAmountPhp: 599,
  dueAt: null,
  createdAt: "2026-06-07T10:00:00.000Z",
  itemSummary: "sms-segment-topup-25",
  manualBillingControlsEnabled: true,
  paymentInstructions: {
    copyText:
      "Hi Tyvera Clinic,\nYour Tyvera top-up request is ready.\nAmount: ₱599\nReference: TYV-2026-000001",
  },
  items: [
    {
      id: "item-1",
      sku: "sms-segment-topup-25",
      purchaseKind: "sms_segment_topup",
      units: 25,
      unitPricePhp: 599,
      quantity: 1,
      totalAmountPhp: 599,
    },
  ],
  payments: [
    {
      id: "payment-1",
      method: "gcash",
      amountPhp: 599,
      status: "pending",
      externalReference: "GCASH-123",
      proofUrl: null,
      notes: null,
      createdAt: "2026-06-07T10:05:00.000Z",
    },
  ],
  fulfillments: [],
  auditLogs: [],
  emailDeliveries: [],
  latestPaymentRequestEmailDelivery: null,
  latestPaymentAcknowledgmentEmailDelivery: null,
} satisfies BillingRequestDetail;

describe("PlatformAdminBillingRequestDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPlatformAdminBillingRequest).mockResolvedValue(billingRequest);
  });

  it("disables confirm while submitting and shows amount mismatch errors clearly", async () => {
    let resolveConfirm: (value: BillingRequestDetail) => void = () => undefined;
    vi.mocked(confirmManualPaymentAndFulfill)
      .mockImplementationOnce(
        () =>
          new Promise<BillingRequestDetail>((resolve) => {
            resolveConfirm = resolve;
          }),
      )
      .mockRejectedValueOnce(
        Object.assign(new Error("Bad request"), {
          responseBody: {
            code: "PAYMENT_AMOUNT_MISMATCH",
            expectedAmountPhp: 599,
            receivedAmountPhp: 500,
          },
        }),
      );

    render(
      <PlatformAdminBillingRequestDetailPage billingRequestId="billing-request-1" />,
    );

    await waitFor(() =>
      expect(screen.getByText("TYV-2026-000001")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /confirm payment/i }));
    const dialogButton = await screen.findByRole("button", {
      name: /confirm and fulfill/i,
    });
    fireEvent.click(dialogButton);
    expect(dialogButton).toBeDisabled();

    resolveConfirm(billingRequest);
    await waitFor(() =>
      expect(confirmManualPaymentAndFulfill).toHaveBeenCalledWith("payment-1"),
    );

    fireEvent.click(screen.getByRole("button", { name: /confirm payment/i }));
    const retryDialogButton = await screen.findByRole("button", {
      name: /confirm and fulfill/i,
    });
    fireEvent.click(retryDialogButton);

    await waitFor(() =>
      expect(
        screen.getByText(/payment amount mismatch/i),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(/expected ₱599/i)).toBeInTheDocument();
    expect(screen.getByText(/received ₱500/i)).toBeInTheDocument();
  });

  it("shows a payment acknowledgment for a fulfilled subscription", async () => {
    vi.mocked(getPlatformAdminBillingRequest).mockResolvedValue({
      ...billingRequest,
      status: "paid_and_fulfilled",
      totalAmountPhp: 999,
      itemSummary: "starter-monthly",
      manualBillingControlsEnabled: true,
      items: [
        {
          id: "item-subscription",
          sku: "starter-monthly",
          purchaseKind: "subscription",
          units: 1,
          unitPricePhp: 999,
          quantity: 1,
          totalAmountPhp: 999,
          planType: "starter",
          billingInterval: "monthly",
          coverageStartsAt: "2026-06-12T04:30:00.000Z",
          coverageEndsAt: "2026-07-12T04:30:00.000Z",
        },
      ],
      payments: [
        {
          id: "payment-1",
          method: "gcash",
          amountPhp: 999,
          status: "verified",
        },
      ],
      fulfillments: [{ id: "fulfillment-1" }],
    } as BillingRequestDetail);

    render(
      <PlatformAdminBillingRequestDetailPage billingRequestId="billing-request-1" />,
    );

    expect(
      await screen.findByText("Payment acknowledgment"),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Paid and activated/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/official receipt/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tax invoice/i)).not.toBeInTheDocument();
  });

  it("uses fulfilled credit wording for an add-on acknowledgment", async () => {
    vi.mocked(getPlatformAdminBillingRequest).mockResolvedValue({
      ...billingRequest,
      status: "paid_and_fulfilled",
      payments: [
        {
          id: "payment-1",
          method: "gcash",
          amountPhp: 599,
          status: "verified",
        },
      ],
      fulfillments: [{ id: "fulfillment-1" }],
    } as BillingRequestDetail);

    render(
      <PlatformAdminBillingRequestDetailPage billingRequestId="billing-request-1" />,
    );

    expect(
      await screen.findByText("Payment acknowledgment"),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Paid and fulfilled/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Credits applied/i)).toBeInTheDocument();
    expect(screen.queryByText(/Paid and activated/i)).not.toBeInTheDocument();
  });

  it("keeps request state visible while manual controls are disabled", async () => {
    vi.mocked(getPlatformAdminBillingRequest).mockResolvedValue({
      ...billingRequest,
      manualBillingControlsEnabled: false,
    } as BillingRequestDetail);

    render(
      <PlatformAdminBillingRequestDetailPage billingRequestId="billing-request-1" />,
    );

    expect(
      await screen.findByText(
        "Manual billing controls are disabled. Review is available, but billing changes cannot be submitted.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("TYV-2026-000001")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /record payment/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /confirm payment/i }),
    ).toBeDisabled();
    expect(screen.getByText(/no email attempts yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send payment request email/i }),
    ).toBeDisabled();
  });

  it("renders payment-request email sent state", async () => {
    vi.mocked(getPlatformAdminBillingRequest).mockResolvedValue({
      ...billingRequest,
      emailDeliveries: [
        {
          id: "delivery-1",
          billingRequestId: "billing-request-1",
          manualPaymentId: null,
          kind: "payment_request",
          recipientEmail: "billing@example.com",
          status: "sent",
          attemptedAt: "2026-06-12T00:00:00.000Z",
          sentAt: "2026-06-12T00:00:00.000Z",
        },
      ],
      latestPaymentRequestEmailDelivery: {
        id: "delivery-1",
        billingRequestId: "billing-request-1",
        manualPaymentId: null,
        kind: "payment_request",
        recipientEmail: "billing@example.com",
        status: "sent",
        attemptedAt: "2026-06-12T00:00:00.000Z",
        sentAt: "2026-06-12T00:00:00.000Z",
      },
    } as BillingRequestDetail);

    render(
      <PlatformAdminBillingRequestDetailPage billingRequestId="billing-request-1" />,
    );

    expect(await screen.findByText("Billing email delivery")).toBeInTheDocument();
    expect(screen.getByText(/payment request: sent/i)).toBeInTheDocument();
    expect(screen.getByText("billing@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /resend payment request email/i }),
    ).toBeInTheDocument();
  });

  it("renders missing-recipient and provider-failed states", async () => {
    vi.mocked(getPlatformAdminBillingRequest).mockResolvedValue({
      ...billingRequest,
      emailDeliveries: [
        {
          id: "delivery-2",
          billingRequestId: "billing-request-1",
          kind: "payment_request",
          recipientEmail: null,
          status: "skipped_missing_recipient",
          failureReason: "Billing contact email is missing.",
          attemptedAt: "2026-06-12T00:00:00.000Z",
        },
        {
          id: "delivery-1",
          billingRequestId: "billing-request-1",
          kind: "payment_request",
          recipientEmail: "billing@example.com",
          status: "failed",
          failureReason: "provider_rejected",
          attemptedAt: "2026-06-11T00:00:00.000Z",
        },
      ],
      latestPaymentRequestEmailDelivery: {
        id: "delivery-2",
        billingRequestId: "billing-request-1",
        kind: "payment_request",
        recipientEmail: null,
        status: "skipped_missing_recipient",
        failureReason: "Billing contact email is missing.",
        attemptedAt: "2026-06-12T00:00:00.000Z",
      },
    } as BillingRequestDetail);

    render(
      <PlatformAdminBillingRequestDetailPage billingRequestId="billing-request-1" />,
    );

    expect(
      await screen.findByText(/payment request: missing recipient/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/provider rejected/i)).toBeInTheDocument();
    expect(screen.getByText("Payment instructions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^copy$/i })).toBeInTheDocument();
  });

  it("resends payment request and disables the button while submitting", async () => {
    let resolveResend: (value: unknown) => void = () => undefined;
    vi.mocked(sendPlatformAdminPaymentRequestEmail).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveResend = resolve;
        }) as never,
    );

    render(
      <PlatformAdminBillingRequestDetailPage billingRequestId="billing-request-1" />,
    );
    await screen.findByText("Billing email delivery");

    const button = screen.getByRole("button", {
      name: /send payment request email/i,
    });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/sending/i);

    resolveResend({
      id: "delivery-1",
      status: "sent",
      recipientEmail: "billing@example.com",
    });
    await waitFor(() =>
      expect(sendPlatformAdminPaymentRequestEmail).toHaveBeenCalledWith(
        "billing-request-1",
      ),
    );
    expect(
      await screen.findByText(/payment request email sent/i),
    ).toBeInTheDocument();
  });

  it("renders acknowledgment delivery after fulfillment and resends it", async () => {
    const fulfilled = {
      ...billingRequest,
      status: "paid_and_fulfilled",
      payments: [
        {
          id: "payment-1",
          method: "gcash",
          amountPhp: 599,
          status: "verified",
        },
      ],
      fulfillments: [{ id: "fulfillment-1" }],
      latestPaymentAcknowledgmentEmailDelivery: {
        id: "delivery-ack",
        billingRequestId: "billing-request-1",
        manualPaymentId: "payment-1",
        kind: "payment_acknowledgment",
        recipientEmail: "billing@example.com",
        status: "failed",
        failureReason: "provider_transient",
        attemptedAt: "2026-06-12T00:00:00.000Z",
      },
      emailDeliveries: [],
    } as BillingRequestDetail;
    vi.mocked(getPlatformAdminBillingRequest).mockResolvedValue(fulfilled);
    vi.mocked(sendPlatformAdminPaymentAcknowledgmentEmail).mockResolvedValue({
      ...fulfilled.latestPaymentAcknowledgmentEmailDelivery!,
      id: "delivery-ack-2",
      status: "sent",
      failureReason: null,
    });

    render(
      <PlatformAdminBillingRequestDetailPage billingRequestId="billing-request-1" />,
    );

    expect(
      await screen.findByText(/payment acknowledgment: failed/i),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /resend acknowledgment/i }),
    );
    await waitFor(() =>
      expect(
        sendPlatformAdminPaymentAcknowledgmentEmail,
      ).toHaveBeenCalledWith("billing-request-1"),
    );
    expect(
      await screen.findByText(/payment acknowledgment email sent/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy acknowledgment/i }),
    ).toBeInTheDocument();
  });
});
