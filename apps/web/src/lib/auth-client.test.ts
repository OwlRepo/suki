import { afterEach, describe, expect, it, vi } from "vitest";
import * as authClient from "./auth-client";

describe("auth-client login contract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not expose OTP sign-in helpers", () => {
    expect((authClient as Record<string, unknown>).startSignIn).toBeUndefined();
    expect((authClient as Record<string, unknown>).verifySignIn).toBeUndefined();
  });

  it("keeps password sign-in helper", () => {
    expect(typeof authClient.signInWithPassword).toBe("function");
  });

  it("posts password with sign-up verification", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(authClient.verifySignUp("new@test.com", "123456", "secret123")).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/auth/sign-up/verify",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "new@test.com", code: "123456", password: "secret123" }),
      }),
    );
  });
});
