import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const signInWithPassword = vi.fn();
const invalidateSessionCache = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

vi.mock("@/lib/auth-client", () => ({
  signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
}));

vi.mock("@/hooks/use-session", () => ({
  invalidateSessionCache: () => invalidateSessionCache(),
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

  it("submits password sign-in and redirects to onboarding when onboarding is incomplete", async () => {
    signInWithPassword.mockResolvedValue({ ok: true, redirectTo: "/onboarding" });
    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: " a@test.com " } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalledWith("a@test.com", "secret123"));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/onboarding"));
    expect(invalidateSessionCache).toHaveBeenCalledOnce();
    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it("submits password sign-in and redirects to dashboard when onboarding is complete", async () => {
    signInWithPassword.mockResolvedValue({ ok: true, redirectTo: "/dashboard" });
    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: " a@test.com " } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalledWith("a@test.com", "secret123"));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard"));
    expect(invalidateSessionCache).toHaveBeenCalledOnce();
    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it("falls back to dashboard when successful sign-in has no redirect metadata", async () => {
    signInWithPassword.mockResolvedValue({ ok: true });
    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: " a@test.com " } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalledWith("a@test.com", "secret123"));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard"));
    expect(invalidateSessionCache).toHaveBeenCalledOnce();
    expect(mockRefresh).toHaveBeenCalledOnce();
  });

  it("shows API error when credentials are invalid", async () => {
    signInWithPassword.mockResolvedValue({ ok: false, message: "Invalid credentials" });
    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@test.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(screen.getByText("Invalid credentials")).toBeInTheDocument());
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(invalidateSessionCache).not.toHaveBeenCalled();
  });
});
