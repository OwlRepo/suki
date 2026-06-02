import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ClerkAuthGuard } from "./clerk-auth.guard";
import type { AuthService } from "./auth.service";

function makeContext(cookie?: string, authorization?: string) {
  const request: {
    headers: { cookie?: string; authorization?: string };
    tenant?: unknown;
  } = {
    headers: {
      cookie,
      authorization,
    },
  };

  return {
    request,
    context: {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext,
  };
}

describe("ClerkAuthGuard", () => {
  function makeGuard(validateSession = vi.fn()) {
    const authService = { validateSession } as unknown as AuthService;
    return { guard: new ClerkAuthGuard(authService), validateSession };
  }

  it("accepts canonical tyvera_session cookies", async () => {
    const { guard, validateSession } = makeGuard(
      vi.fn(async () => ({
        user: { id: "u1", organizationId: "o1", role: "owner", email: "u@test.com" },
      })),
    );
    const { context, request } = makeContext("tyvera_session=current-token");

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(validateSession).toHaveBeenCalledWith("current-token");
    expect(request.tenant).toEqual({
      organizationId: "o1",
      userId: "u1",
      role: "owner",
      email: "u@test.com",
    });
  });

  it("prefers tyvera_session over bearer tokens", async () => {
    const { guard, validateSession } = makeGuard(
      vi.fn(async () => ({
        user: { id: "u1", organizationId: "o1", role: "owner", email: "u@test.com" },
      })),
    );
    const { context } = makeContext("tyvera_session=current-token", "Bearer other-token");

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(validateSession).toHaveBeenCalledWith("current-token");
  });

  it("rejects missing session cookies and bearer tokens", async () => {
    const { guard } = makeGuard();
    const { context } = makeContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
