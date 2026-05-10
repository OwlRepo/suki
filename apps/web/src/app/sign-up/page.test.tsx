import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockPush = vi.fn();
const startSignUp = vi.fn();
const verifySignUp = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/auth-client", () => ({
  startSignUp: (...args: unknown[]) => startSignUp(...args),
  verifySignUp: (...args: unknown[]) => verifySignUp(...args),
}));

import SignUpPage from "./page";

describe("Custom SignUpPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends OTP then verifies and redirects", async () => {
    startSignUp.mockResolvedValue({ ok: true });
    verifySignUp.mockResolvedValue({ ok: true });

    render(<SignUpPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "new@test.com" } });
    fireEvent.click(screen.getByRole("button", { name: /send code/i }));

    await waitFor(() => expect(startSignUp).toHaveBeenCalledWith("new@test.com"));

    fireEvent.change(screen.getByLabelText(/code/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(verifySignUp).toHaveBeenCalledWith("new@test.com", "123456"));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard"));
  });

  it("renders mobile-first auth shell", () => {
    render(<SignUpPage />);
    expect(screen.getByTestId("auth-page-shell")).toBeInTheDocument();
    expect(screen.getByTestId("auth-card")).toBeInTheDocument();
  });
});
