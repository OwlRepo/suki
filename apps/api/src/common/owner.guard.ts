import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from "@nestjs/common";
import type { TenantContext } from "./tenant.decorator";

@Injectable()
export class OwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ tenant?: TenantContext }>();
    const role = request.tenant?.role;
    if (role !== "owner") {
      throw new ForbiddenException("Owner only");
    }
    return true;
  }
}
