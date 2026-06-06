import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockReplace = vi.fn();
const mockGetPlatformAdminSession = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock("./platform-admin.api", () => ({
  getPlatformAdminSession: () => mockGetPlatformAdminSession(),
}));

import { RequirePlatformAdmin } from "./require-platform-admin";

describe("RequirePlatformAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders protected content for authorized platform admins", async () => {
    mockGetPlatformAdminSession.mockResolvedValue({
      platformAdmin: { id: "pa-1", userId: "user-1", status: "active" },
      roles: ["FOUNDER"],
      permissions: ["PLATFORM_ADMIN_ACCESS", "OVERVIEW_VIEW"],
    });

    render(
      <RequirePlatformAdmin>
        <p>Internal overview</p>
      </RequirePlatformAdmin>,
    );

    expect(screen.getByText("Checking internal access...")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Internal overview")).toBeInTheDocument());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users to sign in without flashing content", async () => {
    const error = new Error("Unauthorized") as Error & { status?: number };
    error.status = 401;
    mockGetPlatformAdminSession.mockRejectedValue(error);

    render(
      <RequirePlatformAdmin>
        <p>Internal overview</p>
      </RequirePlatformAdmin>,
    );

    expect(screen.queryByText("Internal overview")).not.toBeInTheDocument();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/sign-in"));
  });

  it("redirects authenticated non-platform users to dashboard without flashing content", async () => {
    const error = new Error("Forbidden") as Error & { status?: number };
    error.status = 403;
    mockGetPlatformAdminSession.mockRejectedValue(error);

    render(
      <RequirePlatformAdmin>
        <p>Internal overview</p>
      </RequirePlatformAdmin>,
    );

    expect(screen.queryByText("Internal overview")).not.toBeInTheDocument();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/dashboard"));
  });
});
