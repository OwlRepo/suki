import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from "@nestjs/common";
import type { TenantContext } from "./tenant.decorator";
import { isFounder } from "./founder-allowlist";

@Injectable()
export class FounderGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ tenant?: TenantContext }>();
    const tenant = request.tenant;
    if (!tenant) {
      throw new ForbiddenException("Founder access required");
    }
    const allowed = isFounder(tenant.clerkId, tenant.email);
    if (!allowed) {
      throw new ForbiddenException("Founder access required");
    }
    return true;
  }
}
