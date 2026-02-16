import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAuthSync } from "./use-auth-sync";

const mockGetToken = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}));

describe("useAuthSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets loading false when not loaded", async () => {
    mockUseAuth.mockReturnValue({
      isLoaded: false,
      isSignedIn: false,
      getToken: mockGetToken,
    });

    const { result } = renderHook(() => useAuthSync());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
    });
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it("sets loading false when loaded but not signed in", async () => {
    mockUseAuth.mockReturnValue({
      isLoaded: true,
      isSignedIn: false,
      getToken: mockGetToken,
    });

    const { result } = renderHook(() => useAuthSync());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBeNull();
    });
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it("calls sync API and sets data when signed in", async () => {
    const syncResult = {
      user: { id: "u1", organizationId: "o1" },
      organization: { id: "o1", name: "Test Org" },
      isNew: true,
    };
    mockUseAuth.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      getToken: async () => "fake-token",
    });

    const { apiRequest } = await import("@/lib/api");
    (apiRequest as ReturnType<typeof vi.fn>).mockResolvedValue(syncResult);

    const { result } = renderHook(() => useAuthSync());
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual(syncResult);
      expect(result.current.error).toBeNull();
    });
    expect(apiRequest).toHaveBeenCalledWith("/auth/sync", {
      method: "POST",
      token: "fake-token",
    });
  });

  it("sets error when sync API fails", async () => {
    mockUseAuth.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      getToken: async () => "token",
    });

    const { apiRequest } = await import("@/lib/api");
    (apiRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Sync failed"));

    const { result } = renderHook(() => useAuthSync());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe("Sync failed");
      expect(result.current.data).toBeNull();
    });
  });
});
