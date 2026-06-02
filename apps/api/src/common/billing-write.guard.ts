import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from "@nestjs/common";
import { PlanCapacityService } from "./plan-capacity.service";

/**
 * Blocks mutation requests when org is in read-only mode (trial expired, past due, etc).
 * Use after ClerkAuthGuard and TenantGuard so tenant context exists.
 */
@Injectable()
export class BillingWriteGuard implements CanActivate {
  constructor(private readonly planCapacity: PlanCapacityService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      tenant?: { organizationId?: string };
    }>();
    const organizationId = request.tenant?.organizationId;
    if (!organizationId) {
      return true;
    }

    if (await this.planCapacity.isReadOnly(organizationId)) {
      throw new ForbiddenException("Account is read-only");
    }

    return true;
  }
}
