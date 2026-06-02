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

  it("sends OTP with email and password, then verifies and redirects", async () => {
    startSignUp.mockResolvedValue({ ok: true });
    verifySignUp.mockResolvedValue({ ok: true });

    render(<SignUpPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: " new@test.com " } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "secret123" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: /send code/i }));

    await waitFor(() => expect(startSignUp).toHaveBeenCalledWith("new@test.com"));
    expect(screen.getByText(/new@test.com/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/code/i), { target: { value: " 123456 " } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(verifySignUp).toHaveBeenCalledWith("new@test.com", "123456", "secret123"));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard"));
  });

  it("validates password mismatch before sending OTP", async () => {
    render(<SignUpPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "new@test.com" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "secret123" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "different123" } });
    fireEvent.click(screen.getByRole("button", { name: /send code/i }));

    expect(startSignUp).not.toHaveBeenCalled();
    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
  });

  it("validates short password before sending OTP", async () => {
    render(<SignUpPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "new@test.com" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: /send code/i }));

    expect(startSignUp).not.toHaveBeenCalled();
    expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
  });

  it("shows send failure message", async () => {
    startSignUp.mockResolvedValue({ ok: false, message: "Cannot send now" });
    render(<SignUpPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "new@test.com" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "secret123" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: /send code/i }));

    await waitFor(() => expect(screen.getByText("Cannot send now")).toBeInTheDocument());
  });

  it("shows verify failure message", async () => {
    startSignUp.mockResolvedValue({ ok: true });
    verifySignUp.mockResolvedValue({ ok: false, message: "Invalid code" });
    render(<SignUpPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "new@test.com" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "secret123" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: /send code/i }));
    await waitFor(() => expect(startSignUp).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/code/i), { target: { value: "123123" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(screen.getByText("Invalid code")).toBeInTheDocument());
  });

  it("validates code before creating account", async () => {
    startSignUp.mockResolvedValue({ ok: true });
    render(<SignUpPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "new@test.com" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "secret123" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: /send code/i }));
    await waitFor(() => expect(startSignUp).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(verifySignUp).not.toHaveBeenCalled();
    expect(screen.getByText("Verification code is required")).toBeInTheDocument();
  });
});
