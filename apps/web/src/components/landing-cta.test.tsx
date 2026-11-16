import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/hooks/use-feature-flags", () => ({
  useFeatureFlags: () => ({ public_signup_enabled: true }),
}));
vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ isSignedIn: false, loading: false }),
}));

import { LandingCta } from "./landing-cta";

describe("LandingCta", () => {
  it("shows login and sign-up links for signed-out users", () => {
    render(<LandingCta />);
    expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute("href", "/sign-in");
    expect(screen.getByRole("link", { name: /try suki free/i })).toHaveAttribute("href", "/sign-up");
  });
});
