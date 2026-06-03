import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BillingSettingsPage from "./page";

const { apiRequestMock, getTokenMock, searchParamsGetMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
  getTokenMock: vi.fn(async () => "cookie-session"),
  searchParamsGetMock: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    getToken: getTokenMock,
  }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: searchParamsGetMock,
  }),
}));

describe("BillingSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsGetMock.mockReturnValue(null);
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path === "/billing/status") {
        return {
          planType: "starter",
          billingStatus: "subscription_active",
          billingInterval: "monthly",
          readOnly: false,
          renewsAt: "2026-07-01T00:00:00.000Z",
          endsAt: null,
          cancellationPending: false,
          scheduledPlanType: null,
          scheduledBillingInterval: null,
          scheduledChangeEffectiveAt: null,
          ownerWarnings: [],
          verifiedOnlineBookingCredits: {
            included: 30,
            addon: 25,
            used: 4,
            remaining: 51,
            total: 55,
          },
          smsSegmentCredits: {
            included: 300,
            addon: 50,
            used: 25,
            remaining: 325,
            total: 350,
          },
          emailCredits: {
            included: 1500,
            used: 400,
            remaining: 1100,
            total: 1500,
          },
          aiRequests: {
            included: 0,
            used: 0,
            remaining: 0,
            total: 0,
          },
          subscription: {
            id: "sub-local",
            planType: "starter",
            status: "active",
          },
        };
      }

      if (path === "/billing/plans") {
        return {
          plans: [
            {
              planType: "free",
              displayName: "Free",
              monthlyPricePhp: 0,
              annualPricePhp: null,
              limits: {
                branches: 1,
                staffAccounts: 1,
                customerRecords: 100,
                staffCreatedAppointmentsPerMonth: 50,
                verifiedOnlineBookingsPerMonth: 5,
                emailMessagesPerMonth: 100,
                aiRequestsPerMonth: 0,
              },
              modules: [],
            },
            {
              planType: "starter",
              displayName: "Starter",
              monthlyPricePhp: 999,
              annualPricePhp: 9990,
              limits: {
                branches: 1,
                staffAccounts: 3,
                customerRecords: 1000,
                staffCreatedAppointmentsPerMonth: null,
                verifiedOnlineBookingsPerMonth: 30,
                emailMessagesPerMonth: 1500,
                aiRequestsPerMonth: 0,
              },
              modules: [],
            },
            {
              planType: "growth",
              displayName: "Growth",
              monthlyPricePhp: 2499,
              annualPricePhp: 24990,
              mostPopular: true,
              limits: {
                branches: 3,
                staffAccounts: 10,
                customerRecords: 5000,
                staffCreatedAppointmentsPerMonth: null,
                verifiedOnlineBookingsPerMonth: 80,
                emailMessagesPerMonth: 5000,
                aiRequestsPerMonth: 100,
              },
              modules: [],
            },
            {
              planType: "pro",
              displayName: "Pro",
              monthlyPricePhp: 5999,
              annualPricePhp: 59990,
              limits: {
                branches: 10,
                staffAccounts: 30,
                customerRecords: 25000,
                staffCreatedAppointmentsPerMonth: null,
                verifiedOnlineBookingsPerMonth: 250,
                emailMessagesPerMonth: 15000,
                aiRequestsPerMonth: 500,
              },
              modules: [],
            },
          ],
        };
      }

      if (path === "/billing/customer-portal") {
        return { url: "https://billing.example/portal" };
      }

      if (path === "/billing/change-plan") {
        return { pendingWebhookSync: true, scheduled: false };
      }

      if (path === "/billing/cancel") {
        return { pendingWebhookSync: true, cancellationScheduled: true };
      }

      throw new Error(`Unexpected path: ${path}`);
    });
  });

  it("renders real verified booking and sms balances plus paid-plan actions", async () => {
    render(<BillingSettingsPage />);

    expect(await screen.findByText("STARTER")).toBeInTheDocument();
    expect(screen.getByText(/renews on/i)).toBeInTheDocument();
    expect(screen.getByText(/51 remaining/i)).toBeInTheDocument();
    expect(screen.getByText(/325 remaining/i)).toBeInTheDocument();
    expect(screen.getByText(/1,100 remaining/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /manage billing/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel subscription/i })).toBeInTheDocument();
  });

  it("uses change-plan for paid plan changes instead of starting a new checkout", async () => {
    render(<BillingSettingsPage />);

    fireEvent.click(await screen.findByRole("button", { name: /switch to growth/i }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/billing/change-plan",
        expect.objectContaining({
          method: "POST",
        }),
      ),
    );
    expect(apiRequestMock).not.toHaveBeenCalledWith(
      "/billing/checkout",
      expect.anything(),
    );
  });

  it("calls the customer portal and cancellation endpoints from the billing actions", async () => {
    render(<BillingSettingsPage />);

    fireEvent.click(await screen.findByRole("button", { name: /manage billing/i }));
    fireEvent.click(await screen.findByRole("button", { name: /cancel subscription/i }));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/billing/customer-portal",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/billing/cancel",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("renders a read-only billing view for staff users and surfaces owner warnings", async () => {
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path === "/billing/status") {
        return {
          planType: "growth",
          billingStatus: "subscription_past_due",
          billingInterval: "monthly",
          readOnly: true,
          renewsAt: "2026-07-01T00:00:00.000Z",
          endsAt: null,
          cancellationPending: false,
          scheduledPlanType: null,
          scheduledBillingInterval: null,
          scheduledChangeEffectiveAt: null,
          ownerWarnings: [
            {
              code: "refund_review",
              severity: "warning",
              message: "A refunded add-on needs manual review before balances can be finalized.",
            },
          ],
          verifiedOnlineBookingCredits: {
            included: 80,
            addon: 0,
            used: 10,
            remaining: 70,
            total: 80,
          },
          smsSegmentCredits: {
            included: 300,
            addon: 0,
            used: 280,
            remaining: 20,
            total: 300,
          },
          emailCredits: {
            included: 5000,
            used: 900,
            remaining: 4100,
            total: 5000,
          },
          aiRequests: {
            included: 100,
            used: 22,
            remaining: 78,
            total: 100,
          },
          subscription: {
            id: "sub-local",
            planType: "growth",
            status: "past_due",
          },
        };
      }

      if (path === "/billing/plans") {
        return { plans: [] };
      }

      throw new Error(`Unexpected path: ${path}`);
    });

    render(<BillingSettingsPage />);

    expect(await screen.findByText(/read-only access/i)).toBeInTheDocument();
    expect(screen.getByText(/manual review/i)).toBeInTheDocument();
    expect(screen.getByText(/4,100 remaining/i)).toBeInTheDocument();
    expect(screen.getByText(/78 remaining/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /manage billing/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /switch to starter/i })).not.toBeInTheDocument();
  });

  it("shows paused, scheduled-downgrade, and delayed-sync billing states from the status payload", async () => {
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path === "/billing/status") {
        return {
          planType: "growth",
          billingStatus: "subscription_paused",
          billingInterval: "monthly",
          readOnly: false,
          renewsAt: "2026-07-01T00:00:00.000Z",
          endsAt: null,
          cancellationPending: false,
          scheduledPlanType: "starter",
          scheduledBillingInterval: "monthly",
          scheduledChangeEffectiveAt: "2026-07-01T00:00:00.000Z",
          ownerWarnings: [
            {
              code: "delayed_webhook_sync",
              severity: "warning",
              message: "Billing changes are still waiting for webhook reconciliation. Refresh shortly if this warning persists.",
            },
          ],
          verifiedOnlineBookingCredits: {
            included: 80,
            addon: 0,
            used: 10,
            remaining: 70,
            total: 80,
            pausedReason: "subscription_paused",
          },
          smsSegmentCredits: {
            included: 300,
            addon: 0,
            used: 280,
            remaining: 20,
            total: 300,
            pausedReason: "subscription_paused",
          },
          emailCredits: {
            included: 5000,
            used: 900,
            remaining: 4100,
            total: 5000,
          },
          aiRequests: {
            included: 100,
            used: 22,
            remaining: 78,
            total: 100,
          },
          subscription: {
            id: "sub-local",
            planType: "growth",
            status: "paused",
          },
        };
      }

      if (path === "/billing/plans") {
        return { plans: [] };
      }

      throw new Error(`Unexpected path: ${path}`);
    });

    render(<BillingSettingsPage />);

    expect(await screen.findByText(/temporarily paused/i)).toBeInTheDocument();
    expect(screen.getByText(/scheduled to move to starter/i)).toBeInTheDocument();
    expect(screen.getByText(/waiting for webhook reconciliation/i)).toBeInTheDocument();
  });
});
