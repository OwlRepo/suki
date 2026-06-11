import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformAdminBusinessDetailPage } from "./platform-admin-business-detail-page";
import {
  getPlatformAdminBillingAddons,
  getPlatformAdminBusiness,
  updatePlatformAdminManualSubscriptionStatus,
} from "./platform-admin-businesses.api";
import {
  createPlatformAdminBillingRequest,
  getPlatformAdminManualBillingCatalog,
} from "../billing/platform-admin-billing.api";

vi.mock("./platform-admin-businesses.api", () => ({
  createSmsAdjustment: vi.fn(),
  getPlatformAdminBillingAddons: vi.fn(),
  getPlatformAdminBusiness: vi.fn(),
  updatePlatformAdminBillingContact: vi.fn(),
  updatePlatformAdminManualSubscriptionStatus: vi.fn(),
}));

vi.mock("../billing/platform-admin-billing.api", () => ({
  createPlatformAdminBillingRequest: vi.fn(),
  getPlatformAdminManualBillingCatalog: vi.fn(),
}));

const detail = {
  organization: {
    id: "org-1",
    name: "Tyvera Clinic",
    currentPlan: "starter",
    billingStatus: "active_manual",
    accessEndsAt: "2026-07-12T04:30:00.000Z",
    nextBillingDueAt: "2026-07-12T04:30:00.000Z",
    billingContactName: null,
    billingContactMobile: null,
    billingContactEmail: null,
    preferredPaymentMethod: null,
  },
  manualBillingControlsEnabled: true,
  smsLedger: {
    month: "2026-06",
    included: 0,
    addon: 0,
    used: 0,
    total: 0,
    remaining: 0,
  },
  verifiedBookingLedger: {
    month: "2026-06",
    included: 30,
    addon: 0,
    used: 2,
    total: 30,
    remaining: 28,
  },
  recentSmsAddons: [],
  recentSmsUsage: [],
  recentBookingAddons: [],
  recentBookingUsage: [],
  billingRequests: [],
  payments: [],
  reconciliation: [],
};

describe("PlatformAdminBusinessDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPlatformAdminBusiness).mockResolvedValue(detail);
    vi.mocked(getPlatformAdminBillingAddons).mockResolvedValue({ addons: [] });
    vi.mocked(getPlatformAdminManualBillingCatalog).mockResolvedValue({
      manualBillingControlsEnabled: true,
      items: [
        {
          sku: "starter-monthly",
          purchaseKind: "subscription",
          pricePhp: 999,
          planType: "starter",
          billingInterval: "monthly",
        },
      ],
    });
  });

  it("renders current manual subscription state", async () => {
    render(<PlatformAdminBusinessDetailPage organizationId="org-1" />);

    expect(screen.getByText(/loading business/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("Manual Subscription")).toBeInTheDocument(),
    );
    expect(screen.getAllByText("starter").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/active manual/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Jul 12, 2026/i)).toHaveLength(2);
  });

  it("renders the disabled banner and disables manual mutations", async () => {
    vi.mocked(getPlatformAdminBusiness).mockResolvedValue({
      ...detail,
      manualBillingControlsEnabled: false,
    });
    vi.mocked(getPlatformAdminManualBillingCatalog).mockResolvedValue({
      manualBillingControlsEnabled: false,
      items: [],
    });

    render(<PlatformAdminBusinessDetailPage organizationId="org-1" />);

    await waitFor(() =>
      expect(
        screen.getByText(
          "Manual billing controls are disabled. Review is available, but billing changes cannot be submitted.",
        ),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: /create subscription request/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /save billing contact/i }),
    ).toBeDisabled();
  });

  it("creates a starter monthly request with the canonical SKU", async () => {
    vi.mocked(createPlatformAdminBillingRequest).mockResolvedValue({
      billingRequest: {
        id: "request-1",
        referenceNumber: "TYV-2026-000001",
      },
      paymentInstructions: { copyText: "Payment instructions" },
    } as never);

    render(<PlatformAdminBusinessDetailPage organizationId="org-1" />);
    await screen.findByText("Manual Subscription");

    fireEvent.click(
      screen.getByRole("button", { name: /create subscription request/i }),
    );

    await waitFor(() =>
      expect(createPlatformAdminBillingRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-1",
          sku: "starter-monthly",
          quantity: 1,
        }),
      ),
    );
    expect(
      await screen.findByText(/created TYV-2026-000001/i),
    ).toBeInTheDocument();
  });

  it("requires a lifecycle reason before opening confirmation", async () => {
    render(<PlatformAdminBusinessDetailPage organizationId="org-1" />);
    await screen.findByText("Lifecycle Actions");

    fireEvent.click(screen.getByRole("button", { name: /mark past due/i }));

    expect(
      screen.getByText(/reason is required for lifecycle actions/i),
    ).toBeInTheDocument();
    expect(updatePlatformAdminManualSubscriptionStatus).not.toHaveBeenCalled();
  });
});
