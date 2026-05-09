import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const mockReplace = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock("@/lib/clerk", () => ({
  hasClerk: true,
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => mockUseAuth(),
  SignIn: () => <div data-testid="sign-in-component" />,
}));

import SignInPage from "./page";

describe("SignInPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to dashboard when user is already signed in", async () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: true });

    render(<SignInPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("renders Clerk SignIn when user is signed out", () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: false });

    render(<SignInPage />);

    expect(screen.getByTestId("sign-in-component")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
