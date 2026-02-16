import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from "@nestjs/common";
import { Request } from "express";
import { PlanCapacityService } from "../common/plan-capacity.service";
import type { TenantContext } from "../common/tenant.decorator";

const AI_MESSAGING_MODULE = "ai_messaging";

@Injectable()
export class PlanAiMessagingGuard implements CanActivate {
  constructor(private readonly planCapacity: PlanCapacityService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { tenant?: TenantContext }>();
    const orgId = request.tenant?.organizationId;
    if (!orgId) throw new ForbiddenException("Unauthorized");
    const hasAccess = await this.planCapacity.checkModuleAccess(orgId, AI_MESSAGING_MODULE);
    if (!hasAccess) {
      throw new ForbiddenException(
        "AI messaging requires the AI Pro plan. Upgrade to access this feature.",
      );
    }
    return true;
  }
}
