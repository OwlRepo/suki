import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformAdminPermission } from "@tyvera/types";
import { PlatformAdminGuard } from "./platform-admin.guard";
import { PLATFORM_ADMIN_PERMISSIONS_KEY } from "./platform-admin.decorator";
import type { PlatformAdminService } from "./platform-admin.service";

function makeContext({
  userId,
  requiredPermissions = [],
}: {
  userId?: string;
  requiredPermissions?: PlatformAdminPermission[];
} = {}) {
  const handler = () => undefined;
  const targetClass = class {};
  const request: {
    tenant?: { organizationId: string; userId?: string; role?: "owner" | "staff" };
    platformAdmin?: unknown;
  } = {
    tenant: userId
      ? { organizationId: "org-1", userId, role: "owner" }
      : undefined,
  };

  Reflect.defineMetadata(PLATFORM_ADMIN_PERMISSIONS_KEY, requiredPermissions, handler);

  return {
    request,
    context: {
      getHandler: () => handler,
      getClass: () => targetClass,
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext,
  };
}

describe("PlatformAdminGuard", () => {
  let service: Pick<PlatformAdminService, "resolveActivePlatformAdmin">;

  beforeEach(() => {
    service = {
      resolveActivePlatformAdmin: vi.fn(),
    };
  });

  it("denies unauthenticated users", async () => {
    const guard = new PlatformAdminGuard(new Reflector(), service as PlatformAdminService);
    const { context } = makeContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.resolveActivePlatformAdmin).not.toHaveBeenCalled();
  });

  it("denies normal tenant owners without an active platform admin row", async () => {
    vi.mocked(service.resolveActivePlatformAdmin).mockResolvedValue(null);
    const guard = new PlatformAdminGuard(new Reflector(), service as PlatformAdminService);
    const { context } = makeContext({ userId: "tenant-owner-1" });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.resolveActivePlatformAdmin).toHaveBeenCalledWith("tenant-owner-1");
  });

  it("allows an active founder with the required permission", async () => {
    vi.mocked(service.resolveActivePlatformAdmin).mockResolvedValue({
      id: "platform-admin-1",
      userId: "founder-user-1",
      roleCodes: ["FOUNDER"],
      permissions: new Set<PlatformAdminPermission>([
        "PLATFORM_ADMIN_ACCESS",
        "OVERVIEW_VIEW",
      ]),
    });
    const guard = new PlatformAdminGuard(new Reflector(), service as PlatformAdminService);
    const { context, request } = makeContext({
      userId: "founder-user-1",
      requiredPermissions: ["OVERVIEW_VIEW"],
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.platformAdmin).toMatchObject({
      id: "platform-admin-1",
      userId: "founder-user-1",
      roleCodes: ["FOUNDER"],
    });
  });

  it("denies active platform admins when a required permission is missing", async () => {
    vi.mocked(service.resolveActivePlatformAdmin).mockResolvedValue({
      id: "platform-admin-1",
      userId: "support-user-1",
      roleCodes: ["SUPPORT"],
      permissions: new Set<PlatformAdminPermission>(["PLATFORM_ADMIN_ACCESS"]),
    });
    const guard = new PlatformAdminGuard(new Reflector(), service as PlatformAdminService);
    const { context } = makeContext({
      userId: "support-user-1",
      requiredPermissions: ["AUDIT_LOG_VIEW"],
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
