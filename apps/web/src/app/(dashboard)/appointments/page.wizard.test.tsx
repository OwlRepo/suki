// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AppointmentsPage from "./page";

const mockApiRequest = vi.fn();
const mockGetToken = vi.fn(async () => "token");
let mockWorkspace = {
  loading: false,
  activeBusinessId: "biz1",
  businesses: [{ id: "biz1", name: "Biz" }],
};

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ getToken: mockGetToken }),
}));

vi.mock("@/hooks/use-auth-sync", () => ({
  useAuthSync: () => ({ data: { organization: { id: "org1" } } }),
}));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => mockWorkspace,
}));

vi.mock("@/lib/api", () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
}));

vi.mock("@/lib/clerk", () => ({ hasClerk: true }));

vi.mock("@/lib/onboarding-metrics", () => ({ recordOnboardingEvent: vi.fn() }));

function setupApi(options?: { createError?: Error }) {
  mockApiRequest.mockImplementation((path: string, init?: { method?: string; body?: string }) => {
    if (path.startsWith("/customers?")) {
      return Promise.resolve({ customers: [{ id: "c1", name: "Alice", mobile: "+639171234567" }] });
    }
    if (path.startsWith("/appointments?")) {
      return Promise.resolve({ appointments: [] });
    }
    if (path.startsWith("/appointments/needs-review")) {
      return Promise.resolve({ appointments: [] });
    }
    if (path.startsWith("/appointments/booking/availability")) {
      return Promise.resolve({
        month: "2026-06",
        slotDurationMins: 30,
        byDay: { "2026-06-10": ["2026-06-10T10:00:00.000Z", "2026-06-10T11:00:00.000Z"] },
      });
    }
    if (path === "/customers/resolve-for-booking" && init?.method === "POST") {
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
    mockWorkspace = {
      loading: false,
      activeBusinessId: "biz1",
      businesses: [{ id: "biz1", name: "Biz" }],
    };
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
    fireEvent.change(screen.getByPlaceholderText("+639171234567"), { target: { value: "+639171234567" } });

    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    expect(await screen.findByRole("button", { name: /6\/12\/2026 unavailable/i })).toBeDisabled();
    fireEvent.click(await screen.findByRole("button", { name: /6\/10\/2026/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /06:00 PM|10:00 AM|11:00 AM/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

    expect(await screen.findByText(/Appointment booked successfully/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Verify via OTP/i })).not.toBeInTheDocument();
  });

  it("blocks invalid new-customer mobile before leaving customer step", async () => {
    render(<AppointmentsPage />);

    fireEvent.click((await screen.findAllByRole("button", { name: /create first appointment/i }))[0]!);
    fireEvent.click(screen.getByRole("button", { name: /new customer/i }));
    fireEvent.change(screen.getByPlaceholderText(/Customer name/i), { target: { value: "Ete" } });
    fireEvent.change(screen.getByPlaceholderText("+639171234567"), { target: { value: "0917" } });

    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/Use \+63 format/i).length).toBeGreaterThan(1);
    });
    expect(screen.queryByText(/Available days/i)).not.toBeInTheDocument();
  });

  it("shows friendly conflict message instead of raw exception", async () => {
    setupApi({ createError: new Error("Conflict Exception") });
    render(<AppointmentsPage />);

    fireEvent.click((await screen.findAllByRole("button", { name: /create first appointment/i }))[0]!);
    fireEvent.click(screen.getByRole("button", { name: /new customer/i }));
    fireEvent.change(screen.getByPlaceholderText(/Customer name/i), { target: { value: "Ete" } });
    fireEvent.change(screen.getByPlaceholderText("+639171234567"), { target: { value: "+639171234567" } });

    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /6\/10\/2026/i }));
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
        return Promise.resolve({ customers: [{ id: "c1", name: "Alice", mobile: "+639171234567" }] });
      }
      if (path.startsWith("/appointments?")) {
        return Promise.resolve({
          appointments: [
            {
              id: "a1",
              customerId: "c1",
              businessId: "biz1",
              scheduledAt: "2026-06-10T10:00:00.000Z",
              status: "scheduled",
              createdAt: recent,
            },
            {
              id: "a2",
              customerId: "c1",
              businessId: "biz1",
              scheduledAt: "2026-06-11T11:00:00.000Z",
              status: "completed",
              createdAt: old,
            },
          ],
        });
      }
      if (path.startsWith("/appointments/needs-review")) {
        return Promise.resolve({ appointments: [] });
      }
      if (path.startsWith("/appointments/booking/availability")) {
        return Promise.resolve({
          month: "2026-06",
          slotDurationMins: 30,
          byDay: { "2026-06-10": ["2026-06-10T10:00:00.000Z"] },
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

  it("scheduled card renders Arrived without generic status dropdown", async () => {
    mockApiRequest.mockImplementation((path: string) => {
      if (path.startsWith("/customers?")) {
        return Promise.resolve({ customers: [{ id: "c1", name: "Alice" }] });
      }
      if (path.startsWith("/appointments/needs-review")) {
        return Promise.resolve({ appointments: [] });
      }
      if (path.startsWith("/appointments?")) {
        return Promise.resolve({
          appointments: [
            {
              id: "a1",
              customerId: "c1",
              businessId: "biz1",
              scheduledAt: "2026-06-10T10:00:00.000Z",
              status: "scheduled",
              durationMinutes: 30,
              createdAt: "2026-06-01T00:00:00.000Z",
            },
          ],
        });
      }
      return Promise.resolve({});
    });

    render(<AppointmentsPage />);

    expect(await screen.findByRole("button", { name: /Arrived/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Change status/i)).not.toBeInTheDocument();
  });

  it("checked_in card renders Complete now", async () => {
    mockApiRequest.mockImplementation((path: string) => {
      if (path.startsWith("/customers?")) return Promise.resolve({ customers: [{ id: "c1", name: "Alice" }] });
      if (path.startsWith("/appointments/needs-review")) return Promise.resolve({ appointments: [] });
      if (path.startsWith("/appointments?")) {
        return Promise.resolve({
          appointments: [{
            id: "a1",
            customerId: "c1",
            businessId: "biz1",
            scheduledAt: "2026-06-10T10:00:00.000Z",
            status: "checked_in",
            durationMinutes: 30,
            createdAt: "2026-06-01T00:00:00.000Z",
          }],
        });
      }
      return Promise.resolve({});
    });

    render(<AppointmentsPage />);

    expect(await screen.findByRole("button", { name: /Complete now/i })).toBeInTheDocument();
  });

  it("needs_review queue renders Completed, Missed, and Reschedule", async () => {
    mockApiRequest.mockImplementation((path: string) => {
      if (path.startsWith("/customers?")) return Promise.resolve({ customers: [{ id: "c1", name: "Alice" }] });
      if (path.startsWith("/appointments/needs-review")) {
        return Promise.resolve({
          appointments: [{
            id: "a1",
            customerId: "c1",
            businessId: "biz1",
            scheduledAt: "2026-06-10T10:00:00.000Z",
            status: "needs_review",
            durationMinutes: 30,
            createdAt: "2026-06-01T00:00:00.000Z",
          }],
        });
      }
      if (path.startsWith("/appointments?")) return Promise.resolve({ appointments: [] });
      return Promise.resolve({});
    });

    render(<AppointmentsPage />);

    expect(await screen.findByText(/Needs review/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Completed$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Missed$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Reschedule$/i })).toBeInTheDocument();
  });

  it("appointments first-load renders a skeleton", async () => {
    mockApiRequest.mockImplementation(() => new Promise(() => undefined));

    render(<AppointmentsPage />);

    expect(await screen.findByLabelText(/Loading appointments/i)).toBeInTheDocument();
  });

  it("appointments read failure renders actionable Retry without erasing the calendar surface", async () => {
    mockApiRequest.mockImplementation((path: string) => {
      if (path.startsWith("/customers?")) return Promise.resolve({ customers: [] });
      if (path.startsWith("/appointments/needs-review")) return Promise.resolve({ appointments: [] });
      if (path.startsWith("/appointments?")) return Promise.reject(new Error("network"));
      return Promise.resolve({});
    });

    render(<AppointmentsPage />);

    expect(await screen.findByText(/Failed to load appointments/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
    expect(screen.getByText(/Calendar view/i)).toBeInTheDocument();
  });

  it("empty selected-day agenda renders the exact empty-state copy", async () => {
    render(<AppointmentsPage />);

    expect(await screen.findByText("No appointments for this day.")).toBeInTheDocument();
    expect(screen.getByText("Create a booking or choose another date.")).toBeInTheDocument();
  });

  it("Needs Review failure renders inline error without hiding the calendar", async () => {
    mockApiRequest.mockImplementation((path: string) => {
      if (path.startsWith("/customers?")) return Promise.resolve({ customers: [] });
      if (path.startsWith("/appointments/needs-review")) return Promise.reject(new Error("review failed"));
      if (path.startsWith("/appointments?")) return Promise.resolve({ appointments: [] });
      return Promise.resolve({});
    });

    render(<AppointmentsPage />);

    expect(await screen.findByText(/Failed to load appointments that need review/i)).toBeInTheDocument();
    expect(screen.getByText(/Calendar view/i)).toBeInTheDocument();
  });

  it("clicking Arrived disables only the clicked appointment card", async () => {
    let arriveResolve: (() => void) | null = null;
    mockApiRequest.mockImplementation((path: string, init?: { method?: string }) => {
      if (path.startsWith("/customers?")) return Promise.resolve({ customers: [{ id: "c1", name: "Alice" }] });
      if (path.startsWith("/appointments/needs-review")) return Promise.resolve({ appointments: [] });
      if (path.startsWith("/appointments?")) {
        return Promise.resolve({
          appointments: ["a1", "a2"].map((id, index) => ({
            id,
            customerId: "c1",
            businessId: "biz1",
            scheduledAt: `2026-06-10T1${index}:00:00.000Z`,
            status: "scheduled",
            durationMinutes: 30,
            createdAt: "2026-06-01T00:00:00.000Z",
          })),
        });
      }
      if (path === "/appointments/a1/arrive" && init?.method === "PATCH") {
        return new Promise((resolve) => {
          arriveResolve = () => resolve({});
        });
      }
      return Promise.resolve({});
    });

    render(<AppointmentsPage />);
    const buttons = await screen.findAllByRole("button", { name: /Arrived/i });
    fireEvent.click(buttons[0]!);

    expect(await screen.findByRole("button", { name: /Marking arrived/i })).toBeDisabled();
    expect(buttons[1]).not.toBeDisabled();
    (arriveResolve as (() => void) | null)?.();
  });

  it("Arrived success renders automatic-completion success message", async () => {
    mockApiRequest.mockImplementation((path: string, init?: { method?: string }) => {
      if (path.startsWith("/customers?")) return Promise.resolve({ customers: [{ id: "c1", name: "Alice" }] });
      if (path.startsWith("/appointments/needs-review")) return Promise.resolve({ appointments: [] });
      if (path.startsWith("/appointments?")) {
        return Promise.resolve({
          appointments: [{
            id: "a1",
            customerId: "c1",
            businessId: "biz1",
            scheduledAt: "2026-06-10T10:00:00.000Z",
            status: "scheduled",
            durationMinutes: 30,
            createdAt: "2026-06-01T00:00:00.000Z",
          }],
        });
      }
      if (path === "/appointments/a1/arrive" && init?.method === "PATCH") return Promise.resolve({});
      return Promise.resolve({});
    });

    render(<AppointmentsPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Arrived/i }));

    expect(await screen.findByText(/Customer marked as arrived. The visit will complete automatically./i)).toBeInTheDocument();
  });

  it("Arrived error restores the button and renders actionable error", async () => {
    mockApiRequest.mockImplementation((path: string, init?: { method?: string }) => {
      if (path.startsWith("/customers?")) return Promise.resolve({ customers: [{ id: "c1", name: "Alice" }] });
      if (path.startsWith("/appointments/needs-review")) return Promise.resolve({ appointments: [] });
      if (path.startsWith("/appointments?")) {
        return Promise.resolve({
          appointments: [{
            id: "a1",
            customerId: "c1",
            businessId: "biz1",
            scheduledAt: "2026-06-10T10:00:00.000Z",
            status: "scheduled",
            durationMinutes: 30,
            createdAt: "2026-06-01T00:00:00.000Z",
          }],
        });
      }
      if (path === "/appointments/a1/arrive" && init?.method === "PATCH") {
        return Promise.reject(new Error("arrive failed"));
      }
      return Promise.resolve({});
    });

    render(<AppointmentsPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Arrived/i }));

    expect(await screen.findByText(/Failed to mark the customer as arrived/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Arrived/i })).not.toBeDisabled();
  });

  it("background-refresh failure after mutation keeps success guidance plus retry copy", async () => {
    let appointmentLoads = 0;
    mockApiRequest.mockImplementation((path: string, init?: { method?: string }) => {
      if (path.startsWith("/customers?")) return Promise.resolve({ customers: [{ id: "c1", name: "Alice" }] });
      if (path.startsWith("/appointments/needs-review")) return Promise.resolve({ appointments: [] });
      if (path.startsWith("/appointments?")) {
        appointmentLoads += 1;
        if (appointmentLoads > 1) return Promise.reject(new Error("refresh failed"));
        return Promise.resolve({
          appointments: [{
            id: "a1",
            customerId: "c1",
            businessId: "biz1",
            scheduledAt: "2026-06-10T10:00:00.000Z",
            status: "scheduled",
            durationMinutes: 30,
            createdAt: "2026-06-01T00:00:00.000Z",
          }],
        });
      }
      if (path === "/appointments/a1/arrive" && init?.method === "PATCH") return Promise.resolve({});
      return Promise.resolve({});
    });

    render(<AppointmentsPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Arrived/i }));

    expect(await screen.findByText(/Customer was marked as arrived, but the list could not refresh. Retry./i)).toBeInTheDocument();
    expect(screen.getByText(/Alice/i)).toBeInTheDocument();
  });

  it("changing active business clears previous business appointments before rendering the next result", async () => {
    mockApiRequest.mockImplementation((path: string) => {
      if (path.startsWith("/customers?")) return Promise.resolve({ customers: [{ id: "c1", name: "Alice" }] });
      if (path.startsWith("/appointments/needs-review")) return Promise.resolve({ appointments: [] });
      if (path.startsWith("/appointments?businessId=biz1")) {
        return Promise.resolve({
          appointments: [{
            id: "a1",
            customerId: "c1",
            businessId: "biz1",
            scheduledAt: "2026-06-10T10:00:00.000Z",
            status: "scheduled",
            durationMinutes: 30,
            createdAt: "2026-06-01T00:00:00.000Z",
          }],
        });
      }
      if (path.startsWith("/appointments?businessId=biz2")) {
        return Promise.resolve({ appointments: [] });
      }
      return Promise.resolve({});
    });

    const rendered = render(<AppointmentsPage />);
    expect(await screen.findByText(/Alice/i)).toBeInTheDocument();

    mockWorkspace = {
      loading: false,
      activeBusinessId: "biz2",
      businesses: [{ id: "biz2", name: "Biz 2" }],
    };
    rendered.rerender(<AppointmentsPage />);

    await waitFor(() => {
      expect(screen.queryByText(/Alice/i)).not.toBeInTheDocument();
    });
  });
});
