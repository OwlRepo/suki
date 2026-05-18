// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AppointmentsPage from "./page";

const mockApiRequest = vi.fn();
const mockGetToken = vi.fn(async () => "token");

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ getToken: mockGetToken }),
}));

vi.mock("@/hooks/use-auth-sync", () => ({
  useAuthSync: () => ({ data: { organization: { id: "org1" } } }),
}));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    loading: false,
    activeBusinessId: "biz1",
    businesses: [{ id: "biz1", name: "Biz" }],
  }),
}));

vi.mock("@/lib/api", () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
}));

vi.mock("@/lib/clerk", () => ({ hasClerk: true }));

vi.mock("@/lib/onboarding-metrics", () => ({ recordOnboardingEvent: vi.fn() }));

function setupApi(options?: { createError?: Error }) {
  mockApiRequest.mockImplementation((path: string, init?: { method?: string; body?: string }) => {
    if (path.startsWith("/customers?")) {
      return Promise.resolve({ customers: [{ id: "c1", name: "Alice", mobile: "0917" }] });
    }
    if (path.startsWith("/appointments?")) {
      return Promise.resolve({ appointments: [] });
    }
    if (path.startsWith("/appointments/booking/availability")) {
      return Promise.resolve({
        month: "2026-05",
        slotDurationMins: 30,
        byDay: { "2026-05-10": ["2026-05-10T10:00:00.000Z", "2026-05-10T11:00:00.000Z"] },
      });
    }
    if (path === "/customers" && init?.method === "POST") {
      return Promise.resolve({ customer: { id: "newc" } });
    }
    if (path === "/appointments" && init?.method === "POST") {
      if (options?.createError) return Promise.reject(options.createError);
      return Promise.resolve({ appointment: { id: "a-new" } });
    }
    return Promise.resolve({});
  });
}

describe("Appointments wizard component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApi();
  });

  it("does not show OTP or manager override guidance in booking section", async () => {
    render(<AppointmentsPage />);
    fireEvent.click((await screen.findAllByRole("button", { name: /create first appointment/i }))[0]!);
    expect(await screen.findByText(/Book appointment/i)).toBeInTheDocument();
    expect(screen.queryByText(/PIN setup is managed in Settings/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Verify via OTP/i)).not.toBeInTheDocument();
  });

  it("progresses new-customer flow and confirms without OTP step", async () => {
    render(<AppointmentsPage />);

    fireEvent.click((await screen.findAllByRole("button", { name: /create first appointment/i }))[0]!);
    fireEvent.click(screen.getByRole("button", { name: /new customer/i }));
    fireEvent.change(screen.getByPlaceholderText(/Customer name/i), { target: { value: "Ete" } });
    fireEvent.change(screen.getByPlaceholderText(/^Mobile$/i), { target: { value: "0917" } });

    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    expect(await screen.findByRole("button", { name: /5\/12\/2026 unavailable/i })).toBeDisabled();
    fireEvent.click(await screen.findByRole("button", { name: /5\/10\/2026/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /06:00 PM|10:00 AM|11:00 AM/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

    expect(await screen.findByText(/Appointment booked successfully/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Verify via OTP/i })).not.toBeInTheDocument();
  });

  it("shows friendly conflict message instead of raw exception", async () => {
    setupApi({ createError: new Error("Conflict Exception") });
    render(<AppointmentsPage />);

    fireEvent.click((await screen.findAllByRole("button", { name: /create first appointment/i }))[0]!);
    fireEvent.click(screen.getByRole("button", { name: /new customer/i }));
    fireEvent.change(screen.getByPlaceholderText(/Customer name/i), { target: { value: "Ete" } });
    fireEvent.change(screen.getByPlaceholderText(/^Mobile$/i), { target: { value: "0917" } });

    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /5\/10\/2026/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /06:00 PM|10:00 AM|11:00 AM/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

    await waitFor(() => {
      expect(screen.getByText(/slot was just taken/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Conflict Exception/i)).not.toBeInTheDocument();
  });

  it("cancel resets wizard so reopening starts from customer step", async () => {
    render(<AppointmentsPage />);

    fireEvent.click((await screen.findAllByRole("button", { name: /create first appointment/i }))[0]!);
    fireEvent.click(screen.getByRole("button", { name: /new customer/i }));
    fireEvent.change(screen.getByPlaceholderText(/Customer name/i), { target: { value: "Tmp" } });
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));

    fireEvent.click((await screen.findAllByRole("button", { name: /create first appointment/i }))[0]!);
    expect(screen.getByRole("button", { name: /existing customer/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new customer/i })).toBeInTheDocument();
  });

  it("shows calendar-day agenda and highlights new appointments", async () => {
    const recent = new Date(Date.now() - 1000 * 60 * 10).toISOString();
    const old = new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString();

    mockApiRequest.mockImplementation((path: string, init?: { method?: string; body?: string }) => {
      if (path.startsWith("/customers?")) {
        return Promise.resolve({ customers: [{ id: "c1", name: "Alice", mobile: "0917" }] });
      }
      if (path.startsWith("/appointments?")) {
        return Promise.resolve({
          appointments: [
            {
              id: "a1",
              customerId: "c1",
              businessId: "biz1",
              scheduledAt: "2026-05-10T10:00:00.000Z",
              status: "scheduled",
              createdAt: recent,
            },
            {
              id: "a2",
              customerId: "c1",
              businessId: "biz1",
              scheduledAt: "2026-05-11T11:00:00.000Z",
              status: "completed",
              createdAt: old,
            },
          ],
        });
      }
      if (path.startsWith("/appointments/booking/availability")) {
        return Promise.resolve({
          month: "2026-05",
          slotDurationMins: 30,
          byDay: { "2026-05-10": ["2026-05-10T10:00:00.000Z"] },
        });
      }
      if (path === "/appointments/booking/hold") return Promise.resolve({ hold: { id: "hold1" } });
      if (path === "/appointments/booking/otp/send") return Promise.resolve({ success: true });
      if (path === "/appointments/booking/otp/verify") return Promise.resolve({ success: true });
      if (path === "/appointments/booking/pin") return Promise.resolve({ success: true });
      return Promise.resolve({});
    });

    render(<AppointmentsPage />);

    expect(await screen.findByText(/selected day agenda/i)).toBeInTheDocument();
    expect(screen.getByText(/^New$/i)).toBeInTheDocument();
    expect(screen.getByText(/2 appointments in this month/i)).toBeInTheDocument();
  });
});
