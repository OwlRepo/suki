import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformAdminClientRequestsPage } from "./platform-admin-client-requests-page";
import { listPlatformAdminClientBillingRequests } from "./platform-admin-client-requests.api";

vi.mock("./platform-admin-client-requests.api", () => ({
  listPlatformAdminClientBillingRequests: vi.fn(),
}));

describe("PlatformAdminClientRequestsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders empty state, filters, and request rows", async () => {
    vi.mocked(listPlatformAdminClientBillingRequests)
      .mockResolvedValueOnce({ clientBillingRequests: [] })
      .mockResolvedValueOnce({
        clientBillingRequests: [
          {
            id: "client-request-1",
            organizationId: "org-1",
            organizationName: "Tyvera Clinic",
            kind: "plan_change",
            status: "submitted",
            requestedPlanType: "growth",
            requestedSku: null,
            requestedQuantity: null,
            note: "Need more staff",
            decisionNote: null,
            linkedBillingRequestId: null,
            createdAt: "2026-06-19T00:00:00.000Z",
            reviewedAt: null,
          },
        ],
      });

    render(<PlatformAdminClientRequestsPage />);
    expect(await screen.findByText(/no client requests/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /submitted/i }));
    await waitFor(() =>
      expect(screen.getByText("Tyvera Clinic")).toBeInTheDocument(),
    );
    expect(listPlatformAdminClientBillingRequests).toHaveBeenLastCalledWith(
      "submitted",
    );
  });
});
