import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";

describe("AuthController", () => {
  const now = new Date("2026-05-01T00:00:00.000Z");

  function makeController(overrides: Partial<AuthService> = {}) {
    const service = {
      startOtp: vi.fn(async () => ({ ok: true })),
      verifyOtpAndSignUp: vi.fn(async () => ({ ok: true, session: { token: "tok", expiresAt: now } })),
      signInWithPassword: vi.fn(async () => ({ ok: true, session: { token: "tok", expiresAt: now }, redirectTo: "/onboarding" })),
      startPasswordReset: vi.fn(async () => ({ ok: true })),
      verifyPasswordReset: vi.fn(async () => ({ ok: true, session: { token: "reset-tok", expiresAt: now }, redirectTo: "/dashboard" })),
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

  it("forwards sign-up start endpoint", async () => {
    const { controller, service } = makeController();
    await controller.signUpStart({ email: "x@test.com" });
    expect(service.startOtp).toHaveBeenCalledWith("x@test.com", "sign_up");
  });

  it("forwards sign-up password and sets cookie on successful verify endpoint", async () => {
    const { controller, service } = makeController();
    const res = makeRes();
    const body = { email: "x@test.com", code: "123456", password: "secret123" };
    await expect(controller.signUpVerify(body, res)).resolves.toEqual({ ok: true });
    expect(service.verifyOtpAndSignUp).toHaveBeenCalledWith("x@test.com", "123456", "secret123");
    expect(res.cookie).toHaveBeenCalledWith("tyvera_session", "tok", expect.objectContaining({ httpOnly: true }));
    expect(res.clearCookie).toHaveBeenCalledWith("suki_session", { path: "/" });
  });

  it("sets cookie on successful password sign-in endpoint", async () => {
    const { controller } = makeController();
    const res = makeRes();
    await expect(controller.signInPassword({ email: "x@test.com", password: "pw" }, res)).resolves.toEqual({ ok: true, redirectTo: "/onboarding" });
    expect(res.cookie).toHaveBeenCalledWith("tyvera_session", "tok", expect.objectContaining({ httpOnly: true }));
    expect(res.clearCookie).toHaveBeenCalledWith("suki_session", { path: "/" });
  });

  it("forwards password reset start endpoint", async () => {
    const { controller, service } = makeController();
    await expect(controller.passwordResetStart({ email: "x@test.com" })).resolves.toEqual({ ok: true });
    expect(service.startPasswordReset).toHaveBeenCalledWith("x@test.com");
  });

  it("sets cookie and returns redirect metadata on successful password reset verify endpoint", async () => {
    const { controller, service } = makeController();
    const res = makeRes();
    const body = { email: "x@test.com", code: "123456", password: "newsecret" };

    await expect(controller.passwordResetVerify(body, res)).resolves.toEqual({ ok: true, redirectTo: "/dashboard" });

    expect(service.verifyPasswordReset).toHaveBeenCalledWith("x@test.com", "123456", "newsecret");
    expect(res.cookie).toHaveBeenCalledWith("tyvera_session", "reset-tok", expect.objectContaining({ httpOnly: true }));
    expect(res.clearCookie).toHaveBeenCalledWith("suki_session", { path: "/" });
  });

  it("does not set cookie on failed password reset verify endpoint", async () => {
    const { controller } = makeController({
      verifyPasswordReset: vi.fn(async () => ({ ok: false, message: "Invalid code" })),
    });
    const res = makeRes();

    await expect(controller.passwordResetVerify({ email: "x@test.com", code: "000000", password: "newsecret" }, res)).resolves.toEqual({
      ok: false,
      message: "Invalid code",
    });

    expect(res.cookie).not.toHaveBeenCalled();
  });

  it("handles me/sync/sign-out token branches", async () => {
    const { controller, service } = makeController();

    await expect(controller.me({ cookies: { tyvera_session: "tok" } } as unknown as Request)).resolves.toEqual({
      user: { id: "u1", email: "a@test.com" },
    });

    await expect(controller.me({ cookies: { suki_session: "legacy" } } as unknown as Request)).resolves.toEqual({
      user: { id: "u1", email: "a@test.com" },
    });
    expect(service.validateSession).toHaveBeenCalledWith("legacy");

    await expect(controller.me({ cookies: {} } as unknown as Request)).rejects.toBeInstanceOf(UnauthorizedException);

    const res = makeRes();
    await expect(controller.signOut(undefined, { cookies: { suki_session: "legacy" } } as unknown as Request, res)).resolves.toEqual({ ok: true });
    expect(service.signOut).toHaveBeenCalledWith("legacy");
    expect(res.clearCookie).toHaveBeenCalledWith("tyvera_session", { path: "/" });
    expect(res.clearCookie).toHaveBeenCalledWith("suki_session", { path: "/" });

    await expect(controller.sync(undefined, { cookies: {} } as unknown as Request)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
