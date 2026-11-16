import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AppointmentsPage from "./page";

const mocks = vi.hoisted(() => ({ api: vi.fn(), replace: vi.fn(), query: "", token: vi.fn(async () => "token") }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(mocks.query), usePathname: () => "/appointments", useRouter: () => ({ replace: mocks.replace, push: vi.fn() }) }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ getToken: mocks.token }) }));
vi.mock("@/hooks/use-auth-sync", () => ({ useAuthSync: () => ({ data: { organization: { id: "org1" } } }) }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ loading: false, activeBusinessId: "biz1", businesses: [{ id: "biz1", name: "Salon" }] }) }));
vi.mock("@/lib/api", () => ({ apiRequest: (...args: unknown[]) => mocks.api(...args) }));
vi.mock("@/lib/onboarding-metrics", () => ({ recordOnboardingEvent: vi.fn() }));

describe("Suki single-screen booking", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.query = "";
    mocks.api.mockImplementation((path: string) => {
      if (path.startsWith("/customers?")) return Promise.resolve({ customers: [{ id: "c1", name: "Alice" }] });
      if (path.startsWith("/appointments/booking/availability")) return Promise.resolve({ month: "2026-11", slotDurationMins: 30, byDay: { "2026-11-17": ["2026-11-17T10:00:00.000Z"] } });
      return Promise.resolve({ appointments: [] });
    });
  });

  it("regression: shows customer, date/time choices and save without intermediate Continue steps", async () => {
    render(<AppointmentsPage />);
    fireEvent.click((await screen.findAllByRole("button", { name: /create first appointment|new appointment/i }))[0]!);
    expect(screen.getByRole("button", { name: /existing customer/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new customer/i })).toBeInTheDocument();
    expect(await screen.findByText(/available days/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Save appointment$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Continue$/i })).not.toBeInTheDocument();
  });

  it("regression: new=1 opens booking directly and close preserves unrelated query parameters", async () => {
    mocks.query = "new=1&source=today";
    render(<AppointmentsPage />);
    expect(await screen.findByRole("button", { name: /^Save appointment$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/i }));
    expect(mocks.replace).toHaveBeenCalledWith("/appointments?source=today", expect.anything());
  });
});
