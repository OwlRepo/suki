import { Controller, Get, Query, UseGuards, BadRequestException } from "@nestjs/common";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { Tenant } from "../common/tenant.decorator";
import { getDb } from "@suki/database";
import { customers, businesses } from "@suki/database";
import { eq, and, gte, desc, like, or } from "drizzle-orm";

@Controller("loyalty")
@UseGuards(ClerkAuthGuard)
export class LoyaltyController {
  @Get("status")
  async getStatus(
    @Query("businessId") businessId: string,
    @Query("threshold") thresholdStr?: string,
    @Query("tag") tag?: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!businessId || !orgId) throw new BadRequestException("businessId required");
    const db = getDb();
    const [biz] = await db
      .select()
      .from(businesses)
      .where(
        and(
          eq(businesses.id, businessId),
          eq(businesses.organizationId, orgId),
        ),
      )
      .limit(1);
    if (!biz) return { customers: [], threshold: 0 };
    const threshold = Math.max(1, parseInt(thresholdStr ?? "5", 10));
    let conditions = and(
      eq(customers.businessId, businessId),
      gte(customers.visitCount, threshold),
    );
    if (tag?.trim()) {
      const t = tag.trim();
      conditions = and(
        conditions,
        or(
          eq(customers.tags, t),
          like(customers.tags, t + ",%"),
          like(customers.tags, "%," + t),
          like(customers.tags, "%,%" + t + ",%"),
        ),
      );
    }
    const list = await db
      .select()
      .from(customers)
      .where(conditions)
      .orderBy(desc(customers.visitCount));
    return {
      customers: list.map((c) => ({
        id: c.id,
        name: c.name,
        visitCount: c.visitCount,
        lastVisitAt: c.lastVisitAt,
        eligible: c.visitCount >= threshold,
      })),
      threshold,
    };
  }
}
