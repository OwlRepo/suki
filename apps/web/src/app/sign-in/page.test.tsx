import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockPush = vi.fn();
const signInWithPassword = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/auth-client", () => ({
  signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
}));

import SignInPage from "./page";

describe("Custom SignInPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders password-only sign-in fields", () => {
    render(<SignInPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send code/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/code/i)).not.toBeInTheDocument();
  });

  it("submits password sign-in and redirects to dashboard", async () => {
    signInWithPassword.mockResolvedValue({ ok: true });
    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: " a@test.com " } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalledWith("a@test.com", "secret123"));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows API error when credentials are invalid", async () => {
    signInWithPassword.mockResolvedValue({ ok: false, message: "Invalid credentials" });
    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@test.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(screen.getByText("Invalid credentials")).toBeInTheDocument());
  });
});
