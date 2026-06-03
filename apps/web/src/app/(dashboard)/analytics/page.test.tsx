import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import AnalyticsPage from "./page";

const { apiRequestMock, usePlanCapabilitiesMock, useWorkspaceMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
  usePlanCapabilitiesMock: vi.fn(),
  useWorkspaceMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue("token") }),
}));

vi.mock("@/hooks/use-plan-capabilities", () => ({
  usePlanCapabilities: usePlanCapabilitiesMock,
}));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: useWorkspaceMock,
}));

vi.mock("@/lib/api", () => ({
  apiRequest: apiRequestMock,
}));

beforeAll(() => {
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  vi.stubGlobal("ResizeObserver", ResizeObserver);
});

function installMocks(planType: "free" | "growth") {
  usePlanCapabilitiesMock.mockReturnValue({
    planType,
    canUseAi: planType === "growth",
    canSeeAssistant: planType === "growth",
    canSeeAiUsage: planType === "growth",
    canSeeAiAnalytics: planType === "growth",
    canSeeRefineWithAi: planType === "growth",
    loading: false,
    billing: null,
    error: null,
    readOnly: false,
    daysRemaining: null,
  });
  useWorkspaceMock.mockReturnValue({ activeBusinessId: "biz-1" });
  apiRequestMock.mockImplementation(async (path: string) => {
    if (path.startsWith("/insights/monitoring")) {
      return {
        windowDays: 30,
        startDate: "2026-05-01",
        ai: {
          daily: [{ day: "2026-06-01", tokens: 10, requests: 1 }],
          featureBreakdown: [{ key: "drafting", tokens: 10, requests: 1 }],
          topUsers: [],
          topBusinesses: [],
        },
        automation: {
          daily: [{ day: "2026-06-01", total: 1, sent: 1, failed: 0, skipped: 0 }],
          statusBreakdown: [{ key: "sent", value: 1 }],
          channelBreakdown: [{ key: "sms", value: 1 }],
          keyBreakdown: [{ key: "appointment_confirmation", value: 1 }],
        },
      };
    }
    throw new Error(`Unexpected path: ${path}`);
  });
}

describe("AnalyticsPage AI visibility", () => {
  it("shows a locked upgrade state when the current plan has no AI", async () => {
    installMocks("free");

    render(<AnalyticsPage />);

    expect(await screen.findByText(/Usage Analytics/i)).toBeInTheDocument();
    expect(
      screen.getByText(/AI analytics are available on Growth and Pro/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/AI Usage Trends/i)).not.toBeInTheDocument();
  });

  it("renders AI charts for AI-enabled plans", async () => {
    installMocks("growth");

    render(<AnalyticsPage />);

    expect(await screen.findByText(/AI Usage Trends/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Feature Breakdown/i)).toBeInTheDocument();
  });
});
