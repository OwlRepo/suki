import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from "@nestjs/common";
import { Request } from "express";
import { getDb } from "@suki/database";
import { businesses } from "@suki/database";
import { eq } from "drizzle-orm";

@Injectable()
export class CrmModeGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const tenant = (request as Request & { tenant?: { organizationId: string } }).tenant;
    const businessId =
      (request as Request & { params?: { businessId?: string } }).params?.businessId ??
      (request as Request & { query?: { businessId?: string } }).query?.businessId ??
      (request as Request & { body?: { businessId?: string } }).body?.businessId;
    if (!businessId || !tenant?.organizationId) {
      throw new ForbiddenException("CRM_FULL_REQUIRED");
    }
    const db = getDb();
    const [biz] = await db
      .select({ crmMode: businesses.crmMode })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);
    if (!biz || biz.crmMode !== "full") {
      throw new ForbiddenException("CRM_FULL_REQUIRED");
    }
    return true;
  }
}
