import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ isSignedIn: false, loading: false }),
}));

import { AuthCta } from "./auth-cta";

describe("AuthCta", () => {
  it("shows login CTA for signed-out users", () => {
    render(<AuthCta />);
    expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute("href", "/sign-in");
  });
});
