import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformAdminOverviewPage } from "./platform-admin-overview-page";
import { getPlatformAdminSession } from "../platform-admin.api";
import { getPlatformAdminCommunicationsSummary } from "../communications/platform-admin-communications.api";
import {
  getPlatformAdminOperationsOverview,
} from "../operations/platform-admin-operations.api";

vi.mock("../platform-admin.api", () => ({
  getPlatformAdminSession: vi.fn(),
}));

vi.mock("../communications/platform-admin-communications.api", () => ({
  getPlatformAdminCommunicationsSummary: vi.fn(),
}));

vi.mock("../operations/platform-admin-operations.api", () => ({
  getPlatformAdminOperationsOverview: vi.fn(),
}));

describe("PlatformAdminOverviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders live provider-health, alert, and failed automation cards", async () => {
    vi.mocked(getPlatformAdminSession).mockResolvedValue({
      platformAdmin: {
        id: "platform-admin-1",
        userId: "user-1",
        status: "active",
      },
      roles: ["FOUNDER"],
      permissions: [
        "PLATFORM_ADMIN_ACCESS",
        "COMMUNICATION_VIEW",
        "AUTOMATION_RUN_VIEW",
        "ALERT_VIEW",
      ],
    });
    vi.mocked(getPlatformAdminCommunicationsSummary).mockResolvedValue({
      range: "24h",
      totals: {
        smsQueued: 0,
        smsSent: 1,
        smsFailed: 2,
        smsDelivered: 1,
        emailSent: 1,
        emailDelivered: 1,
        emailFailed: 3,
        emailBounced: 0,
        emailRejected: 0,
        openManualFollowUps: 4,
        otpSendFailures: 5,
      },
      failureRates: {
        smsFailureRatePct: 0,
        emailFailureRatePct: 0,
        otpFailureRatePct: 0,
      },
      series: [],
    });
    vi.mocked(getPlatformAdminOperationsOverview).mockResolvedValue({
      providerHealth: [
        {
          provider: "semaphore",
          status: "degraded",
          creditBalance: 350,
          observedAt: "2026-06-07T10:00:00.000Z",
          metrics: null,
        },
        {
          provider: "resend",
          status: "healthy",
          creditBalance: null,
          observedAt: "2026-06-07T10:00:00.000Z",
          metrics: { failureRatePct: 0 },
        },
      ],
      criticalAlerts: 1,
      failedAutomationRunsLast24h: 2,
    });

    render(<PlatformAdminOverviewPage />);

    await waitFor(() =>
      expect(screen.getByText(/Semaphore provider health/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Resend provider health/i)).toBeInTheDocument();
    expect(screen.getByText(/Critical alerts/i)).toBeInTheDocument();
    expect(screen.getByText(/Failed automation runs/i)).toBeInTheDocument();
  });
});
