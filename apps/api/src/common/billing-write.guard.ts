import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from "@nestjs/common";
import { Request } from "express";
import { PlanCapacityService } from "./plan-capacity.service";
import type { TenantContext } from "./tenant.decorator";

/**
 * Blocks mutation requests when org is in read-only mode (trial expired, past due, etc).
 * Use after ClerkAuthGuard and TenantGuard so tenant context exists.
 */
@Injectable()
export class BillingWriteGuard implements CanActivate {
  constructor(private readonly planCapacity: PlanCapacityService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { tenant?: TenantContext }>();
    const method = request.method?.toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;
    const orgId = request.tenant?.organizationId;
    if (!orgId) return true; // let other guards handle missing tenant
    const readOnly = await this.planCapacity.isReadOnly(orgId);
    if (readOnly) {
      throw new ForbiddenException(
        "Access is read-only. Contact us to continue using Suki.",
      );
    }
    return true;
  }
}
