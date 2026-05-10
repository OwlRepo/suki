import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "./auth.service";
import type { TenantContext } from "../common/tenant.decorator";

const COOKIE_NAME = "suki_session";

function readCookie(rawCookieHeader?: string): Record<string, string> {
  if (!rawCookieHeader) return {};
  return rawCookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, part) => {
      const i = part.indexOf("=");
      if (i === -1) return acc;
      const k = decodeURIComponent(part.slice(0, i));
      const v = decodeURIComponent(part.slice(i + 1));
      acc[k] = v;
      return acc;
    }, {});
}

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { tenant?: TenantContext }>();
    const authHeader = request.headers.authorization;
    const bearer = authHeader?.replace(/^Bearer\s+/i, "").trim();
    const cookies = readCookie(request.headers.cookie);
    const token = cookies[COOKIE_NAME] || bearer;

    if (!token) {
      throw new UnauthorizedException("Missing authentication token");
    }

    const session = await this.authService.validateSession(token);
    if (!session) {
      throw new UnauthorizedException("Invalid token");
    }

    request.tenant = {
      organizationId: session.user.organizationId,
      userId: session.user.id,
      role: session.user.role as "owner" | "staff",
      email: session.user.email ?? undefined,
    };

    (request as Request & { user?: { id: string } }).user = { id: session.user.id };
    return true;
  }
}
