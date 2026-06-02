import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const signOut = vi.fn();
const invalidateSessionCache = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

vi.mock("@/lib/auth-client", () => ({
  signOut: () => signOut(),
}));

vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ loading: false, isSignedIn: true, user: { id: "u1" } }),
  invalidateSessionCache: () => invalidateSessionCache(),
}));

import { AuthButton } from "./auth-button";

describe("AuthButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signOut.mockResolvedValue({ ok: true });
  });

  it("invalidates session cache, redirects home, and refreshes after sign-out", async () => {
    render(<AuthButton />);

    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
    expect(invalidateSessionCache).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith("/");
    expect(mockRefresh).toHaveBeenCalledOnce();
  });
});
