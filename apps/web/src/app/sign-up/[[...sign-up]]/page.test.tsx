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
  SignUp: () => <div data-testid="sign-up-component" />,
}));

import SignUpPage from "./page";

describe("SignUpPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to dashboard when user is already signed in", async () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: true });

    render(<SignUpPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("renders Clerk SignUp when user is signed out", () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: false });

    render(<SignUpPage />);

    expect(screen.getByTestId("sign-up-component")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.queryByText(/invite-only access/i)).not.toBeInTheDocument();
  });
});
