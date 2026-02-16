import { Controller, Get, UseGuards, UnauthorizedException } from "@nestjs/common";
import { sql, inArray } from "drizzle-orm";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { Tenant } from "../common/tenant.decorator";
import { getDb } from "@suki/database";
import { customers, businesses, appointments, promos } from "@suki/database";
import { eq } from "drizzle-orm";

@Controller("admin")
@UseGuards(ClerkAuthGuard)
export class AdminController {
  @Get("summary")
  async getSummary(@Tenant("organizationId") orgId?: string) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    const db = getDb();
    const bizList = await db
      .select()
      .from(businesses)
      .where(eq(businesses.organizationId, orgId));
    const bizIds = bizList.map((b) => b.id);
    if (bizIds.length === 0) {
      return { businesses: 0, customers: 0, appointments: 0, promos: 0 };
    }
    const custRes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(inArray(customers.businessId, bizIds));
    const apptRes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(appointments)
      .where(inArray(appointments.businessId, bizIds));
    const promoRes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(promos)
      .where(inArray(promos.businessId, bizIds));
    return {
      businesses: bizList.length,
      customers: custRes[0]?.count ?? 0,
      appointments: apptRes[0]?.count ?? 0,
      promos: promoRes[0]?.count ?? 0,
    };
  }
}
