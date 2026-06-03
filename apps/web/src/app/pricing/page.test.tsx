import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PricingPage from "./page";

const { apiRequestMock, useSessionMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
  useSessionMock: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
}));

vi.mock("@/hooks/use-session", () => ({
  useSession: () => useSessionMock(),
}));

describe("PricingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionMock.mockReturnValue({
      loading: false,
      isSignedIn: false,
      user: null,
    });
    apiRequestMock.mockResolvedValue({
      checkoutEnabled: false,
      annualCheckoutEnabled: false,
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
      ],
    });
  });

  it("shows annual pricing while annual paid checkout remains disabled", async () => {
    render(<PricingPage />);

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith("/billing/plans"),
    );
    expect(await screen.findByRole("tab", { name: "Annual" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Annual" }));
    expect(screen.getByText(/Annual billing is visible now but not yet self-serve/i)).toBeInTheDocument();
  });

  it("routes signed-out pricing CTAs to sign-up", async () => {
    render(<PricingPage />);
    expect(await screen.findByRole("link", { name: /get started/i })).toHaveAttribute(
      "href",
      "/sign-up",
    );
  });

  it("routes signed-in owners and staff to billing settings", async () => {
    useSessionMock.mockReturnValue({
      loading: false,
      isSignedIn: true,
      user: { id: "u1", role: "owner", organizationId: "org-1" },
    });
    render(<PricingPage />);
    expect(await screen.findByRole("link", { name: /get started/i })).toHaveAttribute(
      "href",
      "/settings/billing",
    );
  });

  it("disables paid checkout CTAs when self-serve billing is off", async () => {
    useSessionMock.mockReturnValue({
      loading: false,
      isSignedIn: false,
      user: null,
    });
    apiRequestMock.mockResolvedValue({
      checkoutEnabled: false,
      annualCheckoutEnabled: false,
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
      ],
    });

    render(<PricingPage />);

    expect(await screen.findByRole("link", { name: /get started/i })).toHaveAttribute(
      "href",
      "/sign-up",
    );
    expect(
      screen.getByRole("button", { name: /self-serve billing disabled/i }),
    ).toBeDisabled();
    expect(screen.getByText(/Paid billing is not yet self-serve/i)).toBeInTheDocument();
  });
});
