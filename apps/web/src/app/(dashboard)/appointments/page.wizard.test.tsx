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

function setupApi(options?: { holdError?: Error }) {
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
    if (path === "/appointments/booking/hold") {
      if (options?.holdError) return Promise.reject(options.holdError);
      return Promise.resolve({ hold: { id: "hold1" } });
    }
    if (path === "/appointments/booking/otp/send") return Promise.resolve({ success: true });
    if (path === "/appointments/booking/otp/verify") return Promise.resolve({ success: true });
    if (path === "/appointments/booking/pin") return Promise.resolve({ success: true });
    return Promise.resolve({});
  });
}

describe("Appointments wizard component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApi();
  });

  it("hides editable manager PIN setup and shows settings guidance", async () => {
    render(<AppointmentsPage />);
    expect(await screen.findByText(/PIN setup is managed in Settings/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Set 4-8 digit PIN/i)).not.toBeInTheDocument();
    expect(screen.getByText(/PIN setup is managed in Settings/i)).toBeInTheDocument();
  });

  it("progresses new-customer flow and defaults verify mode to OTP when mobile exists", async () => {
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

    expect(await screen.findByRole("button", { name: /Verify via OTP/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Manager override/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Verify OTP and confirm/i })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/6-digit OTP/i), { target: { value: "123456" } });
    expect(screen.getByRole("button", { name: /Verify OTP and confirm/i })).toBeEnabled();
  });

  it("defaults verify mode to manager override when mobile is missing", async () => {
    render(<AppointmentsPage />);

    fireEvent.click((await screen.findAllByRole("button", { name: /create first appointment/i }))[0]!);
    fireEvent.click(screen.getByRole("button", { name: /new customer/i }));
    fireEvent.change(screen.getByPlaceholderText(/Customer name/i), { target: { value: "NoMobile" } });

    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /5\/10\/2026/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /06:00 PM|10:00 AM|11:00 AM/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

    expect(await screen.findByText(/Manager override \(when customer OTP is not possible\)/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirm with manager override/i })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/Manager PIN/i), { target: { value: "1234" } });
    fireEvent.change(screen.getByPlaceholderText(/Reason for OTP skip/i), {
      target: { value: "Customer has no phone" },
    });
    expect(screen.getByRole("button", { name: /Confirm with manager override/i })).toBeEnabled();
  });

  it("shows friendly conflict message instead of raw exception", async () => {
    setupApi({ holdError: new Error("Conflict Exception") });
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
});
