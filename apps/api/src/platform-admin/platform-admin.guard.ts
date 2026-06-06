import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { PlatformAdminPermission } from "@tyvera/types";
import type { TenantContext } from "../common/tenant.decorator";
import {
  PLATFORM_ADMIN_PERMISSIONS_KEY,
} from "./platform-admin.decorator";
import {
  PlatformAdminService,
  type ActivePlatformAdmin,
} from "./platform-admin.service";

export type PlatformAdminRequest = Request & {
  tenant?: TenantContext;
  platformAdmin?: ActivePlatformAdmin;
};

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly platformAdminService: PlatformAdminService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PlatformAdminRequest>();
    const userId = request.tenant?.userId;

    if (!userId) {
      throw new ForbiddenException("Platform admin access required");
    }

    const platformAdmin =
      await this.platformAdminService.resolveActivePlatformAdmin(userId);

    if (!platformAdmin) {
      throw new ForbiddenException("Platform admin access required");
    }

    const required =
      this.reflector.getAllAndOverride<PlatformAdminPermission[]>(
        PLATFORM_ADMIN_PERMISSIONS_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? [];

    const allowed = required.every((permission) =>
      platformAdmin.permissions.has(permission),
    );

    if (!allowed) {
      throw new ForbiddenException("Insufficient permission");
    }

    request.platformAdmin = platformAdmin;
    return true;
  }
}
