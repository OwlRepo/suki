import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface TenantContext {
  organizationId: string;
  userId?: string;
  role?: "owner" | "staff";
}

/**
 * Extracts tenant context from request. Populated by TenantGuard.
 */
export const Tenant = createParamDecorator(
  (data: keyof TenantContext | undefined, ctx: ExecutionContext): TenantContext | string | undefined => {
    const request = ctx.switchToHttp().getRequest<{ tenant?: TenantContext }>();
    const tenant = request.tenant;
    if (!tenant) return undefined;
    return data ? tenant[data] : tenant;
  },
);
