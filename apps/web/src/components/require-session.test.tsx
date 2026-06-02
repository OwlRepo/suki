import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const mockReplace = vi.fn();
let sessionState = { loading: false, isSignedIn: true, user: { id: "u1" } as { id: string } | null };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock("@/hooks/use-session", () => ({
  useSession: () => sessionState,
}));

import { RequireSession } from "./require-session";

describe("RequireSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionState = { loading: false, isSignedIn: true, user: { id: "u1" } };
  });

  it("renders protected content for signed-in users", () => {
    render(
      <RequireSession>
        <p>Protected dashboard</p>
      </RequireSession>,
    );

    expect(screen.getByText("Protected dashboard")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("shows loading state without rendering protected content", () => {
    sessionState = { loading: true, isSignedIn: false, user: null };

    render(
      <RequireSession>
        <p>Protected dashboard</p>
      </RequireSession>,
    );

    expect(screen.getByText("Checking your session…")).toBeInTheDocument();
    expect(screen.queryByText("Protected dashboard")).not.toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("redirects signed-out users without flashing protected content", async () => {
    sessionState = { loading: false, isSignedIn: false, user: null };

    render(
      <RequireSession>
        <p>Protected dashboard</p>
      </RequireSession>,
    );

    expect(screen.queryByText("Protected dashboard")).not.toBeInTheDocument();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/sign-in"));
  });
});
