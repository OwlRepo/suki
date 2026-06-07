import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformAdminAutomationRunsPage } from "./platform-admin-automation-runs-page";
import {
  getPlatformAdminProviderHealth,
  listPlatformAdminAutomationRuns,
} from "./platform-admin-operations.api";

vi.mock("./platform-admin-operations.api", () => ({
  getPlatformAdminProviderHealth: vi.fn(),
  listPlatformAdminAutomationRuns: vi.fn(),
}));

describe("PlatformAdminAutomationRunsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPlatformAdminProviderHealth).mockResolvedValue({
      providers: [],
    });
  });

  it("renders loading, empty, error, and populated states", async () => {
    vi.mocked(listPlatformAdminAutomationRuns)
      .mockResolvedValueOnce({
        items: [],
        summary: {
          lastAppointmentReminderRun: null,
          lastInactivityWinbackRun: null,
          lastSemaphoreReconciliationRun: null,
          failedRunsLast24h: 0,
        },
        pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
      })
      .mockRejectedValueOnce(new Error("Unable to load automation runs"))
      .mockResolvedValueOnce({
        items: [
          {
            id: "run-1",
            jobKey: "appointment_reminders",
            status: "completed",
            processedCount: 2,
            successCount: 2,
            failureCount: 0,
            errorSummary: null,
            startedAt: "2026-06-07T10:00:00.000Z",
            finishedAt: "2026-06-07T10:00:05.000Z",
          },
        ],
        summary: {
          lastAppointmentReminderRun: "2026-06-07T10:00:00.000Z",
          lastInactivityWinbackRun: null,
          lastSemaphoreReconciliationRun: null,
          failedRunsLast24h: 0,
        },
        pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
      });

    render(<PlatformAdminAutomationRunsPage />);

    expect(screen.getByText(/loading automation runs/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/no automation runs found/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    await waitFor(() =>
      expect(screen.getByText(/unable to load automation runs/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() =>
      expect(screen.getByText("appointment_reminders")).toBeInTheDocument(),
    );
  });
});
