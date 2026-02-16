import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import type { TenantContext } from "./tenant.decorator";

/**
 * Resolves tenant context (organizationId, userId, role) from auth.
 * For now, uses header X-Organization-Id for org. Will integrate Clerk JWT validation later.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { tenant?: TenantContext }>();
    const orgId = request.headers["x-organization-id"] as string | undefined;
    const userId = request.headers["x-user-id"] as string | undefined;
    const role = request.headers["x-user-role"] as "owner" | "staff" | undefined;

    if (!orgId) {
      throw new UnauthorizedException("Missing X-Organization-Id header");
    }

    request.tenant = {
      organizationId: orgId,
      userId,
      role: role ?? "owner",
    };
    return true;
  }
}
