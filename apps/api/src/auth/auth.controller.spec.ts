import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { ACCESS_NOT_APPROVED, AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";

describe("AuthController", () => {
  const now = new Date("2026-05-01T00:00:00.000Z");

  function makeController(overrides: Partial<AuthService> = {}) {
    const service = {
      startOtp: vi.fn(async () => ({ ok: true })),
      verifyOtpAndSignIn: vi.fn(async () => ({ ok: true, session: { token: "tok", expiresAt: now } })),
      verifyOtpAndSignUp: vi.fn(async () => ({ ok: true, session: { token: "tok", expiresAt: now } })),
      setPasswordAfterOtpLock: vi.fn(async () => ({ ok: true })),
      signInWithPassword: vi.fn(async () => ({ ok: true, session: { token: "tok", expiresAt: now } })),
      validateSession: vi.fn(async () => ({ user: { id: "u1", email: "a@test.com" } })),
      signOut: vi.fn(async () => undefined),
      syncFromSession: vi.fn(async () => ({ user: { id: "u1", organizationId: "o1" }, organization: { id: "o1", name: "Org" }, isNew: false })),
      ...overrides,
    } as unknown as AuthService;
    return { controller: new AuthController(service), service };
  }

  function makeRes() {
    return { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as Response;
  }

  it("forwards start endpoints", async () => {
    const { controller, service } = makeController();
    await controller.signInStart({ email: "x@test.com" });
    await controller.signUpStart({ email: "x@test.com" });
    expect(service.startOtp).toHaveBeenCalledWith("x@test.com", "sign_in");
    expect(service.startOtp).toHaveBeenCalledWith("x@test.com", "sign_up");
  });

  it("sets cookie on successful verify endpoints", async () => {
    const { controller } = makeController();
    const res = makeRes();
    await expect(controller.signInVerify({ email: "x@test.com", code: "123456" }, res)).resolves.toEqual({ ok: true });
    await expect(controller.signUpVerify({ email: "x@test.com", code: "123456" }, res)).resolves.toEqual({ ok: true });
    expect(res.cookie).toHaveBeenCalled();
  });

  it("maps invite-only sign-up rejection to forbidden", async () => {
    const { controller } = makeController({ verifyOtpAndSignUp: vi.fn(async () => { throw new Error(ACCESS_NOT_APPROVED); }) as never });
    await expect(controller.signUpVerify({ email: "x@test.com", code: "123456" }, makeRes())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("handles me/sync/sign-out token branches", async () => {
    const { controller, service } = makeController();

    await expect(controller.me({ cookies: { suki_session: "tok" } } as unknown as Request)).resolves.toEqual({
      user: { id: "u1", email: "a@test.com" },
    });

    await expect(controller.me({ cookies: {} } as unknown as Request)).rejects.toBeInstanceOf(UnauthorizedException);

    const res = makeRes();
    await expect(controller.signOut(undefined, { cookies: { suki_session: "tok" } } as unknown as Request, res)).resolves.toEqual({ ok: true });
    expect(service.signOut).toHaveBeenCalledWith("tok");
    expect(res.clearCookie).toHaveBeenCalled();

    await expect(controller.sync(undefined, { cookies: {} } as unknown as Request)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
