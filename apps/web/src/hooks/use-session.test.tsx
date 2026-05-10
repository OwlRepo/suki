import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const getSessionMock = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  getSession: (...args: unknown[]) => getSessionMock(...args),
}));

import { useSession, __resetSessionCacheForTests } from "./use-session";

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
});
