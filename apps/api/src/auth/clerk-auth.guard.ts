import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "./auth.service";
import type { TenantContext } from "../common/tenant.decorator";
import { getDb } from "@suki/database";
import { users } from "@suki/database";
import { eq } from "drizzle-orm";

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { tenant?: TenantContext }>();
    const authHeader = request.headers.authorization;
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (!token) {
      throw new UnauthorizedException("Missing Authorization header");
    }
    const payload = await this.authService.verifyToken(token);
    if (!payload) {
      throw new UnauthorizedException("Invalid token");
    }
    const db = getDb();
    const [user] = await db
      .select({
        id: users.id,
        organizationId: users.organizationId,
        role: users.role,
      })
      .from(users)
      .where(eq(users.clerkId, payload.clerkId))
      .limit(1);
    if (!user) {
      throw new UnauthorizedException("User not synced. Call POST /auth/sync first.");
    }
    request.tenant = {
      organizationId: user.organizationId,
      userId: user.id,
      role: user.role as "owner" | "staff",
      clerkId: payload.clerkId,
      email: payload.email,
    };
    (request as Request & { user?: { id: string } }).user = { id: user.id };
    return true;
  }
}
