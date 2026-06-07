import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformAdminCommunicationsPage } from "./platform-admin-communications-page";
import {
  getPlatformAdminCommunicationDetail,
  getPlatformAdminCommunicationsSummary,
  listPlatformAdminCommunications,
} from "./platform-admin-communications.api";
import type {
  PlatformAdminCommunicationDetail,
  PlatformAdminCommunicationListResponse,
  PlatformAdminCommunicationsSummary,
} from "./platform-admin-communications.types";

vi.mock("./platform-admin-communications.api", () => ({
  getPlatformAdminCommunicationDetail: vi.fn(),
  getPlatformAdminCommunicationsSummary: vi.fn(),
  listPlatformAdminCommunications: vi.fn(),
}));

const summary: PlatformAdminCommunicationsSummary = {
  range: "24h",
  totals: {
    smsQueued: 1,
    smsSent: 10,
    smsFailed: 2,
    smsDelivered: 8,
    emailSent: 9,
    emailDelivered: 7,
    emailFailed: 1,
    emailBounced: 1,
    emailRejected: 0,
    openManualFollowUps: 3,
    otpSendFailures: 2,
  },
  failureRates: {
    smsFailureRatePct: 16.67,
    emailFailureRatePct: 11.11,
    otpFailureRatePct: 25,
  },
  series: [
    {
      bucket: "2026-06-07T10:00:00.000Z",
      smsSent: 4,
      smsFailed: 1,
      emailDelivered: 3,
      emailFailed: 1,
      otpFailures: 2,
    },
  ],
};

const listResponse: PlatformAdminCommunicationListResponse = {
  items: [
    {
      id: "message-1",
      organizationId: "org-1",
      organizationName: "Tyvera Clinic",
      businessId: "business-1",
      businessName: "Main Branch",
      appointmentId: null,
      customerId: "customer-1",
      customerName: "Romeo Angeles",
      recipientMasked: "*******4567",
      channel: "sms",
      automationKey: "appointment_reminder_24h",
      purpose: "transactional",
      status: "sent",
      deliveryStatus: "failed",
      provider: "semaphore",
      retryCount: 1,
      unitsConsumed: 2,
      failureReason: "semaphore_failed",
      sentAt: null,
      createdAt: "2026-06-07T09:59:00.000Z",
    },
  ],
  pagination: {
    page: 1,
    limit: 25,
    total: 1,
    totalPages: 1,
  },
};

const detail: PlatformAdminCommunicationDetail = {
  id: "message-1",
  organization: { id: "org-1", name: "Tyvera Clinic" },
  business: { id: "business-1", name: "Main Branch" },
  customer: {
    id: "customer-1",
    name: "Romeo Angeles",
    recipientMasked: "*******4567",
  },
  appointmentId: null,
  automationKey: "appointment_reminder_24h",
  purpose: "transactional",
  channel: "sms",
  status: "sent",
  deliveryStatus: "failed",
  provider: "semaphore",
  providerMessageId: "provider-1",
  retryCount: 1,
  unitsConsumed: 2,
  failureReason: "semaphore_failed",
  sentAt: null,
  createdAt: "2026-06-07T09:59:00.000Z",
  manualFollowUpTask: {
    id: "task-1",
    status: "open",
    failureReason: "semaphore_failed",
    createdAt: "2026-06-07T10:00:00.000Z",
    resolvedAt: null,
  },
};

describe("PlatformAdminCommunicationsPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  it("renders loading, empty, error, and populated states", async () => {
    vi.mocked(getPlatformAdminCommunicationsSummary)
      .mockResolvedValueOnce(summary)
      .mockRejectedValueOnce(new Error("Unable to load communications"))
      .mockResolvedValueOnce(summary);
    vi.mocked(listPlatformAdminCommunications)
      .mockResolvedValueOnce({ ...listResponse, items: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } })
      .mockResolvedValueOnce(listResponse)
      .mockResolvedValueOnce(listResponse);

    render(<PlatformAdminCommunicationsPage />);

    expect(screen.getByText(/loading communications/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/no communications found/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getAllByRole("button", { name: /refresh/i })[0]);
    await waitFor(() =>
      expect(screen.getByText(/unable to load communications/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() =>
      expect(screen.getByText("Main Branch")).toBeInTheDocument(),
    );
    expect(screen.getByText("*******4567")).toBeInTheDocument();
    expect(screen.getByText(/semaphore_failed/i)).toBeInTheDocument();
  });

  it("refreshes the list when filters are applied", async () => {
    vi.mocked(getPlatformAdminCommunicationsSummary).mockResolvedValue(summary);
    vi.mocked(listPlatformAdminCommunications).mockResolvedValue(listResponse);

    render(<PlatformAdminCommunicationsPage />);

    await waitFor(() =>
      expect(screen.getByText("Main Branch")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText(/automation key/i), {
      target: { value: "appointment_reminder_24h" },
    });
    fireEvent.click(screen.getByRole("button", { name: /apply filters/i }));

    await waitFor(() =>
      expect(listPlatformAdminCommunications).toHaveBeenLastCalledWith(
        expect.objectContaining({ automationKey: "appointment_reminder_24h" }),
      ),
    );
  });

  it("opens the detail drawer with message details", async () => {
    vi.mocked(getPlatformAdminCommunicationsSummary).mockResolvedValue(summary);
    vi.mocked(listPlatformAdminCommunications).mockResolvedValue(listResponse);
    vi.mocked(getPlatformAdminCommunicationDetail).mockResolvedValue(detail);

    render(<PlatformAdminCommunicationsPage />);

    await waitFor(() =>
      expect(screen.getByText("Main Branch")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /view message message-1/i }));

    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument(),
    );
    expect(screen.getByText(/related manual follow-up/i)).toBeInTheDocument();
    expect(screen.getByText("provider-1")).toBeInTheDocument();
    expect(screen.getAllByText("*******4567").length).toBeGreaterThan(0);
  });
});
