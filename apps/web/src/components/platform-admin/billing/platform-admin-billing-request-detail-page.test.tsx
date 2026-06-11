import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformAdminBillingRequestDetailPage } from "./platform-admin-billing-request-detail-page";
import {
  confirmManualPaymentAndFulfill,
  getPlatformAdminBillingRequest,
  type BillingRequestDetail,
} from "./platform-admin-billing.api";

vi.mock("./platform-admin-billing.api", () => ({
  confirmManualPaymentAndFulfill: vi.fn(),
  getPlatformAdminBillingRequest: vi.fn(),
  recordManualPayment: vi.fn(),
  rejectManualPayment: vi.fn(),
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
  });
});
