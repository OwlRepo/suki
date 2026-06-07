import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformAdminAlertsPage } from "./platform-admin-alerts-page";
import {
  getPlatformAdminProviderHealth,
  listPlatformAdminAlerts,
  updatePlatformAdminAlert,
} from "./platform-admin-operations.api";

vi.mock("./platform-admin-operations.api", () => ({
  getPlatformAdminProviderHealth: vi.fn(),
  listPlatformAdminAlerts: vi.fn(),
  updatePlatformAdminAlert: vi.fn(),
}));

describe("PlatformAdminAlertsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPlatformAdminProviderHealth).mockResolvedValue({
      providers: [],
    });
  });

  it("renders loading, empty, error, and populated states", async () => {
    vi.mocked(listPlatformAdminAlerts)
      .mockResolvedValueOnce({
        items: [],
        summary: {
          openCriticalAlerts: 0,
          openWarningAlerts: 0,
          acknowledgedAlerts: 0,
          resolvedAlertsLast24h: 0,
        },
        pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
      })
      .mockRejectedValueOnce(new Error("Unable to load alerts"))
      .mockResolvedValueOnce({
        items: [
          {
            id: "alert-1",
            alertKey: "semaphore_credits_warning",
            severity: "warning",
            status: "open",
            provider: "semaphore",
            title: "Semaphore credits are low",
            description: "Semaphore credit balance is below warning threshold.",
            metadata: { balance: 350 },
            detectedAt: "2026-06-07T10:00:00.000Z",
            acknowledgedAt: null,
            resolvedAt: null,
          },
        ],
        summary: {
          openCriticalAlerts: 0,
          openWarningAlerts: 1,
          acknowledgedAlerts: 0,
          resolvedAlertsLast24h: 0,
        },
        pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
      });

    render(<PlatformAdminAlertsPage />);

    expect(screen.getByText(/loading alerts/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/no alerts found/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    await waitFor(() =>
      expect(screen.getByText(/unable to load alerts/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() =>
      expect(screen.getByText("Semaphore credits are low")).toBeInTheDocument(),
    );
  });

  it("disables acknowledge while submitting", async () => {
    vi.mocked(listPlatformAdminAlerts).mockResolvedValue({
      items: [
        {
          id: "alert-1",
          alertKey: "sms_outage_suspected",
          severity: "critical",
          status: "open",
          provider: "semaphore",
          title: "SMS outage suspected",
          description: "SMS failures are elevated.",
          metadata: null,
          detectedAt: "2026-06-07T10:00:00.000Z",
          acknowledgedAt: null,
          resolvedAt: null,
        },
      ],
      summary: {
        openCriticalAlerts: 1,
        openWarningAlerts: 0,
        acknowledgedAlerts: 0,
        resolvedAlertsLast24h: 0,
      },
      pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
    });
    let resolveUpdate: () => void = () => undefined;
    vi.mocked(updatePlatformAdminAlert).mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = () => resolve({ ok: true });
      }) as never,
    );

    render(<PlatformAdminAlertsPage />);

    await waitFor(() =>
      expect(screen.getByText("SMS outage suspected")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /acknowledge/i }));

    expect(screen.getByRole("button", { name: /acknowledging/i })).toBeDisabled();
    resolveUpdate();
    await waitFor(() =>
      expect(updatePlatformAdminAlert).toHaveBeenCalledWith("alert-1", {
        action: "acknowledge",
      }),
    );
  });
});
