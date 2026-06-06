import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

function makeContext(tenant?: {
  organizationId: string;
  userId?: string;
  role?: "owner" | "staff";
  clerkId?: string;
  email?: string;
}) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ tenant }),
    }),
  } as unknown as ExecutionContext;
}

describe("FounderGuard", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.FOUNDER_ALLOWLIST_USER_IDS;
    delete process.env.FOUNDER_ALLOWLIST_EMAILS;
  });

  it("allows existing user-ID founder allowlist entries", async () => {
    process.env.FOUNDER_ALLOWLIST_USER_IDS = "local_founder_1";
    const { FounderGuard } = await import("./founder.guard");

    expect(
      new FounderGuard().canActivate(
        makeContext({
          organizationId: "org-1",
          userId: "user-1",
          role: "owner",
          clerkId: "local_founder_1",
          email: "owner@example.com",
        }),
      ),
    ).toBe(true);
  });

  it("allows existing email founder allowlist entries", async () => {
    process.env.FOUNDER_ALLOWLIST_EMAILS = "founder@example.com";
    const { FounderGuard } = await import("./founder.guard");

    expect(
      new FounderGuard().canActivate(
        makeContext({
          organizationId: "org-1",
          userId: "user-1",
          role: "owner",
          clerkId: "local_user_1",
          email: "Founder@Example.com",
        }),
      ),
    ).toBe(true);
  });

  it("denies non-allowlisted users", async () => {
    process.env.FOUNDER_ALLOWLIST_USER_IDS = "local_founder_1";
    const { FounderGuard } = await import("./founder.guard");

    expect(() =>
      new FounderGuard().canActivate(
        makeContext({
          organizationId: "org-1",
          userId: "user-1",
          role: "owner",
          clerkId: "local_user_1",
          email: "owner@example.com",
        }),
      ),
    ).toThrow(ForbiddenException);
  });
});
