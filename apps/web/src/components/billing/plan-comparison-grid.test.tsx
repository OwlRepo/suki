import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BillingIntervalToggle } from "./billing-interval-toggle";
import { PlanComparisonGrid } from "./plan-comparison-grid";
import type { BillingPlan } from "./types";

const plans: BillingPlan[] = [
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
];

describe("billing plan components", () => {
  it("renders all required plans and highlights growth as most popular", () => {
    render(
      <PlanComparisonGrid
        plans={plans}
        interval="monthly"
        ctaHref="/sign-up"
        annualCheckoutEnabled={false}
      />,
    );

    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("Starter")).toBeInTheDocument();
    expect(screen.getByText("Growth")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("Most Popular")).toBeInTheDocument();
  });

  it("updates the selected billing interval accessibly", () => {
    const onChange = vi.fn();
    render(<BillingIntervalToggle value="monthly" onChange={onChange} />);

    fireEvent.click(screen.getByRole("tab", { name: "Annual" }));
    expect(onChange).toHaveBeenCalledWith("annual");
  });

  it("disables annual paid CTAs when annual checkout is not self-serve yet", () => {
    render(
      <PlanComparisonGrid
        plans={plans}
        interval="annual"
        ctaHref="/settings/billing"
        annualCheckoutEnabled={false}
      />,
    );

    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute("href", "/settings/billing");
    expect(screen.getAllByText(/Annual billing is visible now but not yet self-serve/i).length).toBeGreaterThan(0);
  });
});
