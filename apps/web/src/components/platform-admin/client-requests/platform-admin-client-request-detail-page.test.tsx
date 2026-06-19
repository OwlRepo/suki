import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformAdminClientRequestDetailPage } from "./platform-admin-client-request-detail-page";
import {
  approvePlatformAdminClientBillingRequest,
  declinePlatformAdminClientBillingRequest,
  getPlatformAdminClientBillingRequest,
  startPlatformAdminClientBillingRequestReview,
} from "./platform-admin-client-requests.api";

vi.mock("./platform-admin-client-requests.api", () => ({
  approvePlatformAdminClientBillingRequest: vi.fn(),
  declinePlatformAdminClientBillingRequest: vi.fn(),
  getPlatformAdminClientBillingRequest: vi.fn(),
  startPlatformAdminClientBillingRequestReview: vi.fn(),
}));

const request = {
  id: "client-request-1",
  organizationId: "org-1",
  organizationName: "Tyvera Clinic",
  kind: "plan_change" as const,
  status: "submitted" as const,
  requestedPlanType: "growth" as const,
  requestedSku: null,
  requestedQuantity: null,
  note: "Need more staff",
  decisionNote: null,
  linkedBillingRequestId: null,
  createdAt: "2026-06-19T00:00:00.000Z",
  reviewedAt: null,
};

describe("PlatformAdminClientRequestDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPlatformAdminClientBillingRequest).mockResolvedValue(request);
    vi.mocked(startPlatformAdminClientBillingRequestReview).mockResolvedValue({
      ...request,
      status: "under_review",
    });
    vi.mocked(approvePlatformAdminClientBillingRequest).mockResolvedValue({
      ...request,
      status: "approved",
      linkedBillingRequestId: "manual-request-1",
    });
    vi.mocked(declinePlatformAdminClientBillingRequest).mockResolvedValue({
      ...request,
      status: "declined",
      decisionNote: "Not eligible",
    });
  });

  it("starts review, approves, and declines through API helpers", async () => {
    render(
      <PlatformAdminClientRequestDetailPage clientRequestId="client-request-1" />,
    );
    await screen.findByText("Tyvera Clinic");

    fireEvent.click(screen.getByRole("button", { name: /start review/i }));
    await waitFor(() =>
      expect(startPlatformAdminClientBillingRequestReview).toHaveBeenCalledWith(
        "client-request-1",
      ),
    );

    fireEvent.change(screen.getByLabelText(/decision note/i), {
      target: { value: "Approved by finance" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));
    await waitFor(() =>
      expect(approvePlatformAdminClientBillingRequest).toHaveBeenCalledWith(
        "client-request-1",
        { decisionNote: "Approved by finance" },
      ),
    );

    vi.mocked(getPlatformAdminClientBillingRequest).mockResolvedValue(request);
    render(
      <PlatformAdminClientRequestDetailPage clientRequestId="client-request-1" />,
    );
    await screen.findAllByText("Tyvera Clinic");
    fireEvent.change(screen.getByLabelText(/decision note/i), {
      target: { value: "Not eligible" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^decline$/i }));
    await waitFor(() =>
      expect(declinePlatformAdminClientBillingRequest).toHaveBeenCalledWith(
        "client-request-1",
        { decisionNote: "Not eligible" },
      ),
    );
  });
});
