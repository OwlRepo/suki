import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

const apiRequestMock = vi.fn();
const syncData = { organization: { id: "o1" } };
const getTokenMock = vi.fn(async () => "cookie-session");

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/clerk", () => ({ hasClerk: true }));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, userId: "u1", getToken: getTokenMock }),
}));
vi.mock("@/hooks/use-auth-sync", () => ({
  useAuthSync: () => ({ data: syncData, loading: false, error: null }),
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ activeBusinessId: "biz1", businesses: [{ id: "biz1", name: "Biz" }], loading: false }),
}));
vi.mock("@/lib/onboarding-metrics", () => ({ recordOnboardingEvent: vi.fn() }));
vi.mock("@/lib/api", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
}));

import DashboardPage from "./dashboard/page";

describe("Dashboard API loop regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiRequestMock.mockImplementation(async (path: string) => {
      if (String(path).startsWith("/admin/summary")) return { businesses: 1, customers: 1, appointments: 1, promos: 0 };
      if (String(path).startsWith("/insights/monthly")) return { metrics: { year: 2026, month: 5, newCustomers: 1, repeatCustomers: 1, repeatVisits: 1 } };
      if (String(path).startsWith("/admin/usage")) return { activeCustomers: 1, newCustomersThisMonth: 1, visitsThisMonth: 1, promosSentThisMonth: 0, month: "2026-05", upcomingAppointments: 2 };
      if (String(path).startsWith("/admin/activity")) return { activities: [] };
      return {};
    });
  });

  it("keeps critical dashboard calls bounded after render/update", async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalled();
    });

    await new Promise((r) => setTimeout(r, 120));

    const calledPaths = apiRequestMock.mock.calls.map((c) => String(c[0]));
    const summaryCalls = calledPaths.filter((p) => p.startsWith("/admin/summary")).length;
    const usageCalls = calledPaths.filter((p) => p.startsWith("/admin/usage")).length;
    const activityCalls = calledPaths.filter((p) => p.startsWith("/admin/activity")).length;

    expect(summaryCalls).toBeLessThanOrEqual(1);
    expect(usageCalls).toBeLessThanOrEqual(1);
    expect(activityCalls).toBeLessThanOrEqual(1);
  });
});
