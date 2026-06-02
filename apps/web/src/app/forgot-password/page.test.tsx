import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const startPasswordReset = vi.fn();
const verifyPasswordReset = vi.fn();
const invalidateSessionCache = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

vi.mock("@/lib/auth-client", () => ({
  startPasswordReset: (...args: unknown[]) => startPasswordReset(...args),
  verifyPasswordReset: (...args: unknown[]) => verifyPasswordReset(...args),
}));

vi.mock("@/hooks/use-session", () => ({
  invalidateSessionCache: () => invalidateSessionCache(),
}));

import ForgotPasswordPage from "./page";

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends reset code, verifies new password, and redirects after auto sign-in", async () => {
    startPasswordReset.mockResolvedValue({ ok: true });
    verifyPasswordReset.mockResolvedValue({ ok: true, redirectTo: "/dashboard" });

    render(<ForgotPasswordPage />);

    expect(screen.getByText(/if an account exists/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: " USER@TEST.COM " } });
    fireEvent.click(screen.getByRole("button", { name: /send code/i }));

    await waitFor(() => expect(startPasswordReset).toHaveBeenCalledWith("user@test.com"));
    expect(screen.getByText(/user@test.com/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: " 123456 " } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "newsecret" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "newsecret" } });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() => expect(verifyPasswordReset).toHaveBeenCalledWith("user@test.com", "123456", "newsecret"));
    expect(screen.getByText(/password updated/i)).toBeInTheDocument();
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard"));
    expect(invalidateSessionCache).toHaveBeenCalledOnce();
    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it("validates reset form before verifying", async () => {
    startPasswordReset.mockResolvedValue({ ok: true });
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "user@test.com" } });
    fireEvent.click(screen.getByRole("button", { name: /send code/i }));
    await waitFor(() => expect(startPasswordReset).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: "123456" } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "different" } });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    expect(verifyPasswordReset).not.toHaveBeenCalled();
    expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
  });

  it("shows verify failure without redirecting", async () => {
    startPasswordReset.mockResolvedValue({ ok: true });
    verifyPasswordReset.mockResolvedValue({ ok: false, message: "Invalid code" });
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "user@test.com" } });
    fireEvent.click(screen.getByRole("button", { name: /send code/i }));
    await waitFor(() => expect(startPasswordReset).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: "123123" } });
    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: "newsecret" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "newsecret" } });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() => expect(screen.getByText("Invalid code")).toBeInTheDocument());
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(invalidateSessionCache).not.toHaveBeenCalled();
  });

  it("lets users go back to the email step", async () => {
    startPasswordReset.mockResolvedValue({ ok: true });
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "user@test.com" } });
    fireEvent.click(screen.getByRole("button", { name: /send code/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /use a different email/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /use a different email/i }));

    expect(screen.getByRole("button", { name: /send code/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to sign in/i })).toHaveAttribute("href", "/sign-in");
  });
});
