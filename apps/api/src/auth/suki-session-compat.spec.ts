import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { AuthController } from "./auth.controller";
import { ClerkAuthGuard } from "./clerk-auth.guard";
import type { AuthService } from "./auth.service";

function fixture() {
  const session = { user: { id: "u1", organizationId: "o1", role: "owner", email: "owner@example.test" } };
  const service = {
    validateSession: vi.fn(async () => session),
    syncFromSession: vi.fn(async () => session),
    signOut: vi.fn(async () => undefined),
    signInWithPassword: vi.fn(async () => ({ ok: true, session: { token: "new-token", expiresAt: new Date("2027-01-01") }, redirectTo: "/dashboard" })),
  } as unknown as AuthService;
  const response = { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as Response;
  return { service, response, controller: new AuthController(service), guard: new ClerkAuthGuard(service) };
}

function context(cookie?: string) {
  return { switchToHttp: () => ({ getRequest: () => ({ headers: { cookie } }) }) } as unknown as ExecutionContext;
}

describe("Suki session compatibility", () => {
  it("error: rejects invalid canonical sessions instead of falling through to a legacy identity", async () => {
    const { guard, service } = fixture();
    vi.mocked(service.validateSession).mockResolvedValue(null);
    await expect(guard.canActivate(context("suki_session=invalid; tyvera_session=legacy"))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(service.validateSession).toHaveBeenCalledExactlyOnceWith("invalid");
  });

  it("edge: continues accepting legacy-only sessions", async () => {
    const { guard, service } = fixture();
    await expect(guard.canActivate(context("tyvera_session=legacy"))).resolves.toBe(true);
    expect(service.validateSession).toHaveBeenCalledWith("legacy");
  });

  it("edge: revokes distinct bearer, canonical, and legacy sessions during sign-out", async () => {
    const { controller, response, service } = fixture();
    await controller.signOut("Bearer header-token", { cookies: { suki_session: "current", tyvera_session: "legacy" } } as unknown as Request, response);
    expect(service.signOut).toHaveBeenCalledTimes(3);
    expect(service.signOut).toHaveBeenCalledWith("header-token");
    expect(service.signOut).toHaveBeenCalledWith("current");
    expect(service.signOut).toHaveBeenCalledWith("legacy");
    expect(response.clearCookie).toHaveBeenCalledWith("suki_session", { path: "/" });
    expect(response.clearCookie).toHaveBeenCalledWith("tyvera_session", { path: "/" });
  });

  it("edge: revokes a repeated session token only once during sign-out", async () => {
    const { controller, response, service } = fixture();
    await controller.signOut("Bearer shared", { cookies: { suki_session: "shared", tyvera_session: "shared" } } as unknown as Request, response);
    expect(service.signOut).toHaveBeenCalledExactlyOnceWith("shared");
    expect(response.clearCookie).toHaveBeenCalledTimes(2);
  });

  it("regression: canonical cookies win in the guard and account endpoints", async () => {
    const { guard, controller, service } = fixture();
    await guard.canActivate(context("tyvera_session=legacy; suki_session=current"));
    await controller.me({ cookies: { tyvera_session: "legacy", suki_session: "current" } } as unknown as Request);
    await controller.sync(undefined, { cookies: { tyvera_session: "legacy", suki_session: "current" } } as unknown as Request);
    expect(service.validateSession).toHaveBeenNthCalledWith(1, "current");
    expect(service.validateSession).toHaveBeenNthCalledWith(2, "current");
    expect(service.syncFromSession).toHaveBeenCalledWith("current");
  });

  it("regression: sign-out clears both cookie names", async () => {
    const { controller, response, service } = fixture();
    await controller.signOut(undefined, { cookies: { suki_session: "current" } } as unknown as Request, response);
    expect(service.signOut).toHaveBeenCalledWith("current");
    expect(response.clearCookie).toHaveBeenCalledWith("suki_session", { path: "/" });
    expect(response.clearCookie).toHaveBeenCalledWith("tyvera_session", { path: "/" });
  });

  it("happy: password sign-in issues the canonical http-only cookie", async () => {
    const { controller, response } = fixture();
    await controller.signInPassword({ email: "owner@example.test", password: "not-a-real-secret" }, response);
    expect(response.cookie).toHaveBeenCalledWith("suki_session", "new-token", expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }));
  });
});
