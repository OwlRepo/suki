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
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
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

  it("uses the same-origin API proxy for production sign-up", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(authClient.startSignUp("new@test.com")).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/sign-up/start",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "new@test.com" }),
      }),
    );
  });

  it("posts password reset start requests", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(authClient.startPasswordReset("user@test.com")).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/password-reset/start",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ email: "user@test.com" }),
      }),
    );
  });

  it("posts password reset verification requests", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ redirectTo: "/dashboard" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(authClient.verifyPasswordReset("user@test.com", "123456", "newsecret")).resolves.toEqual({
      ok: true,
      redirectTo: "/dashboard",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/auth/password-reset/verify",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ email: "user@test.com", code: "123456", password: "newsecret" }),
      }),
    );
  });
});
