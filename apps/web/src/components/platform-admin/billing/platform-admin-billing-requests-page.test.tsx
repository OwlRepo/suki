import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformAdminBillingRequestsPage } from "./platform-admin-billing-requests-page";
import { listPlatformAdminBillingRequests } from "./platform-admin-billing.api";

vi.mock("./platform-admin-billing.api", () => ({
  listPlatformAdminBillingRequests: vi.fn(),
}));

describe("PlatformAdminBillingRequestsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading, empty, error, and success states with retry", async () => {
    vi.mocked(listPlatformAdminBillingRequests)
      .mockResolvedValueOnce({ billingRequests: [] })
      .mockRejectedValueOnce(new Error("Unable to load billing requests"))
      .mockResolvedValueOnce({
        billingRequests: [
          {
            id: "billing-request-1",
            referenceNumber: "TYV-2026-000001",
            organizationId: "org-1",
            organizationName: "Tyvera Clinic",
            status: "awaiting_payment",
            totalAmountPhp: 599,
            dueAt: null,
            createdAt: "2026-06-07T10:00:00.000Z",
            itemSummary: "sms-segment-topup-25",
          },
        ],
      });

    render(<PlatformAdminBillingRequestsPage />);

    expect(screen.getByText(/loading billing requests/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/no billing requests yet/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    await waitFor(() =>
      expect(screen.getByText(/unable to load billing requests/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() =>
      expect(screen.getByText("TYV-2026-000001")).toBeInTheDocument(),
    );
    expect(screen.getByText("Tyvera Clinic")).toBeInTheDocument();
  });
});
