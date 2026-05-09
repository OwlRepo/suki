import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

let mockSignedIn = false;

vi.mock("@/lib/clerk", () => ({
  hasClerk: true,
}));

vi.mock("@clerk/nextjs", () => ({
  SignedIn: ({ children }: { children: ReactNode }) => (mockSignedIn ? <>{children}</> : null),
  SignedOut: ({ children }: { children: ReactNode }) => (!mockSignedIn ? <>{children}</> : null),
}));

import { AuthCta } from "./auth-cta";

describe("AuthCta", () => {
  beforeEach(() => {
    mockSignedIn = false;
  });

  it("shows login CTA for signed-out users", () => {
    render(<AuthCta />);

    expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute("href", "/sign-in");
    expect(screen.queryByText(/request access/i)).not.toBeInTheDocument();
  });

  it("shows dashboard CTA for signed-in users", () => {
    mockSignedIn = true;
    render(<AuthCta />);

    expect(screen.getByRole("link", { name: /go to dashboard/i })).toHaveAttribute("href", "/dashboard");
  });
});
