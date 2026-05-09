import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

let mockSignedIn = false;
const mockFlags = { public_signup_enabled: true };

vi.mock("@/lib/clerk", () => ({
  hasClerk: true,
}));

vi.mock("@/hooks/use-feature-flags", () => ({
  useFeatureFlags: () => mockFlags,
}));

vi.mock("@clerk/nextjs", () => ({
  SignedIn: ({ children }: { children: ReactNode }) => (mockSignedIn ? <>{children}</> : null),
  SignedOut: ({ children }: { children: ReactNode }) => (!mockSignedIn ? <>{children}</> : null),
}));

import { LandingCta } from "./landing-cta";

describe("LandingCta", () => {
  beforeEach(() => {
    mockSignedIn = false;
    mockFlags.public_signup_enabled = true;
  });

  it("shows login link for signed-out single-primary mode", () => {
    render(<LandingCta singlePrimary />);

    expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute("href", "/sign-in");
    expect(screen.queryByText(/request access/i)).not.toBeInTheDocument();
  });

  it("shows login and sign-up links for signed-out multi-action mode", () => {
    render(<LandingCta />);

    expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute("href", "/sign-in");
    expect(screen.getByRole("link", { name: /try suki free/i })).toHaveAttribute("href", "/sign-up");
  });

  it("shows dashboard CTA for signed-in users", () => {
    mockSignedIn = true;
    render(<LandingCta singlePrimary />);

    expect(screen.getByRole("link", { name: /go to dashboard/i })).toHaveAttribute("href", "/dashboard");
  });
});
