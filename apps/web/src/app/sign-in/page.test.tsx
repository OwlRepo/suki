import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockPush = vi.fn();
const startSignIn = vi.fn();
const verifySignIn = vi.fn();
const signInWithPassword = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/auth-client", () => ({
  startSignIn: (...args: unknown[]) => startSignIn(...args),
  verifySignIn: (...args: unknown[]) => verifySignIn(...args),
  signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
}));

import SignInPage from "./page";

describe("Custom SignInPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends OTP and verifies to dashboard", async () => {
    startSignIn.mockResolvedValue({ ok: true });
    verifySignIn.mockResolvedValue({ ok: true, fallbackUnlocked: false });

    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: " a@test.com " } });
    fireEvent.click(screen.getByRole("button", { name: /send code/i }));

    await waitFor(() => expect(startSignIn).toHaveBeenCalledWith("a@test.com"));

    fireEvent.change(screen.getByLabelText(/code/i), { target: { value: " 123456 " } });
    fireEvent.click(screen.getByRole("button", { name: /verify code/i }));

    await waitFor(() => expect(verifySignIn).toHaveBeenCalledWith("a@test.com", "123456"));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows send-code failure message", async () => {
    startSignIn.mockResolvedValue({ ok: false, message: "Rate limited" });
    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@test.com" } });
    fireEvent.click(screen.getByRole("button", { name: /send code/i }));

    await waitFor(() => expect(screen.getByText("Rate limited")).toBeInTheDocument());
  });

  it("shows invalid verify message without enabling password fallback", async () => {
    startSignIn.mockResolvedValue({ ok: true });
    verifySignIn.mockResolvedValue({ ok: false, message: "Invalid code", fallbackUnlocked: false });

    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@test.com" } });
    fireEvent.click(screen.getByRole("button", { name: /send code/i }));
    await waitFor(() => expect(startSignIn).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/code/i), { target: { value: "111111" } });
    fireEvent.click(screen.getByRole("button", { name: /verify code/i }));

    await waitFor(() => expect(screen.getByText("Invalid code")).toBeInTheDocument());
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it("shows password fallback and handles failed password sign-in", async () => {
    startSignIn.mockResolvedValue({ ok: true });
    verifySignIn.mockResolvedValue({ ok: false, fallbackUnlocked: true, message: "Too many attempts" });
    signInWithPassword.mockResolvedValue({ ok: false, message: "Invalid credentials" });

    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@test.com" } });
    fireEvent.click(screen.getByRole("button", { name: /send code/i }));
    await waitFor(() => expect(startSignIn).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/code/i), { target: { value: "111111" } });
    fireEvent.click(screen.getByRole("button", { name: /verify code/i }));

    await waitFor(() => expect(screen.getByLabelText(/password/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in with password/i }));

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalledWith("a@test.com", "secret123"));
    await waitFor(() => expect(screen.getByText("Invalid credentials")).toBeInTheDocument());
  });
});
