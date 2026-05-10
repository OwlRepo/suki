import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ loading: false, isSignedIn: true, user: { id: "u1", email: "u@test.com" } }),
}));

import { useAuth } from "./auth";

describe("useAuth", () => {
  it("keeps getToken reference stable across rerenders", () => {
    const { result, rerender } = renderHook(() => useAuth());
    const first = result.current.getToken;
    rerender();
    const second = result.current.getToken;
    expect(first).toBe(second);
  });
});
