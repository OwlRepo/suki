import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const getSessionMock = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  getSession: (...args: unknown[]) => getSessionMock(...args),
}));

import { useSession, invalidateSessionCache, __resetSessionCacheForTests } from "./use-session";

describe("useSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetSessionCacheForTests();
  });

  it("dedupes /auth/me across multiple consumers", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "u1", email: "u@test.com" } });

    const h1 = renderHook(() => useSession());
    const h2 = renderHook(() => useSession());

    await waitFor(() => expect(h1.result.current.loading).toBe(false));
    await waitFor(() => expect(h2.result.current.loading).toBe(false));

    expect(getSessionMock).toHaveBeenCalledTimes(1);
  });

  it("caches a signed-in session until invalidated", async () => {
    getSessionMock.mockResolvedValueOnce({ user: { id: "u1", email: "u@test.com" } });

    const first = renderHook(() => useSession());
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.isSignedIn).toBe(true);
    first.unmount();

    const cached = renderHook(() => useSession());
    expect(cached.result.current.loading).toBe(false);
    expect(cached.result.current.isSignedIn).toBe(true);
    expect(getSessionMock).toHaveBeenCalledTimes(1);
    cached.unmount();

    getSessionMock.mockResolvedValueOnce(null);
    invalidateSessionCache();

    const afterInvalidation = renderHook(() => useSession());
    await waitFor(() => expect(afterInvalidation.result.current.loading).toBe(false));
    expect(afterInvalidation.result.current.isSignedIn).toBe(false);
    expect(getSessionMock).toHaveBeenCalledTimes(2);
  });

  it("caches a signed-out session until invalidated", async () => {
    getSessionMock.mockResolvedValueOnce(null);

    const first = renderHook(() => useSession());
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.isSignedIn).toBe(false);
    first.unmount();

    const cached = renderHook(() => useSession());
    expect(cached.result.current.loading).toBe(false);
    expect(cached.result.current.isSignedIn).toBe(false);
    expect(getSessionMock).toHaveBeenCalledTimes(1);
    cached.unmount();

    getSessionMock.mockResolvedValueOnce({ user: { id: "u2", email: "u2@test.com" } });
    invalidateSessionCache();

    const afterInvalidation = renderHook(() => useSession());
    await waitFor(() => expect(afterInvalidation.result.current.loading).toBe(false));
    expect(afterInvalidation.result.current.isSignedIn).toBe(true);
    expect(afterInvalidation.result.current.user?.id).toBe("u2");
    expect(getSessionMock).toHaveBeenCalledTimes(2);
  });

  it("resets cached state through the test helper", async () => {
    getSessionMock.mockResolvedValueOnce(null);

    const first = renderHook(() => useSession());
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    first.unmount();

    getSessionMock.mockResolvedValueOnce({ user: { id: "u3" } });
    __resetSessionCacheForTests();

    const second = renderHook(() => useSession());
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.isSignedIn).toBe(true);
    expect(getSessionMock).toHaveBeenCalledTimes(2);
  });
});
