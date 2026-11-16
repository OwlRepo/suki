import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "./page";

const mocks = vi.hoisted(() => ({ api: vi.fn(), getToken: vi.fn(async () => "session"), workspace: { activeBusinessId: "biz1", businesses: [{ id: "biz1", name: "Salon" }], loading: false } }));
vi.mock("@/lib/api", () => ({ apiRequest: mocks.api }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ getToken: mocks.getToken }) }));
vi.mock("@/hooks/use-auth-sync", () => ({ useAuthSync: () => ({ data: { organization: { id: "org1" } } }) }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => mocks.workspace }));
vi.mock("@/lib/onboarding-metrics", () => ({ recordOnboardingEvent: vi.fn() }));
vi.mock("@/components/intake-qr-block", () => ({ IntakeQRBlock: () => <p>Booking link and QR</p> }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

function setupApi(failAgenda = false) {
  mocks.api.mockImplementation(async (path: string) => {
    if (path.startsWith("/appointments?")) {
      if (failAgenda) throw new Error("Offline");
      return { appointments: [{ id: "a1", customerId: "c1", scheduledAt: new Date().toISOString(), status: "scheduled", durationMinutes: 30 }] };
    }
    if (path.startsWith("/customers?")) return { customers: [{ id: "c1", name: "Mia Santos" }] };
    if (path === "/appointments/a1/arrive") return {};
    if (path === "/messaging/manual-follow-ups/open-count") return { count: 2 };
    if (path === "/admin/summary") return { businesses: 1, customers: 5, appointments: 1, promos: 0 };
    if (path.startsWith("/admin/usage")) return { visitsThisMonth: 12, month: "2026-11", upcomingAppointments: 1 };
    if (path.startsWith("/admin/activity")) return { activities: [] };
    if (path.startsWith("/insights/monthly")) return { metrics: { repeatVisits: 12 } };
    throw new Error(`Unexpected path ${path}`);
  });
}

beforeEach(() => { vi.clearAllMocks(); setupApi(); });

describe("Today daily workspace", () => {
  it("error: offers a retry when the daily agenda cannot load", async () => {
    setupApi(true);
    render(<DashboardPage />);
    expect(await screen.findByText(/unable to load today.s appointments/i)).toBeInTheDocument();
    setupApi();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByText("Mia Santos")).toBeInTheDocument();
  });

  it("regression: loads a bounded day and makes arrival and rescheduling direct", async () => {
    render(<DashboardPage />);
    expect(await screen.findByRole("heading", { name: "Today", exact: true })).toBeInTheDocument();
    expect(await screen.findByText("Mia Santos")).toBeInTheDocument();
    const agendaCall = mocks.api.mock.calls.find(([path]) => String(path).startsWith("/appointments?"));
    const url = new URL(String(agendaCall?.[0]), "https://example.test");
    expect(url.searchParams.get("businessId")).toBe("biz1");
    expect(url.searchParams.get("from")).toBeTruthy();
    expect(url.searchParams.get("to")).toBeTruthy();
    expect(screen.getByRole("link", { name: /reschedule/i })).toHaveAttribute("href", "/appointments?reschedule=a1");
    fireEvent.click(screen.getByRole("button", { name: /^arrived$/i }));
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith("/appointments/a1/arrive", expect.objectContaining({ method: "PATCH" })));
  });
});
