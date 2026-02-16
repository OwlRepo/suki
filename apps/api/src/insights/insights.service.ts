import { Injectable } from "@nestjs/common";
import { getDb } from "@suki/database";
import { customers, businesses } from "@suki/database";
import { eq, and, gte, lte, sql } from "drizzle-orm";

@Injectable()
export class InsightsService {
  async getMonthlyMetrics(
    businessId: string,
    organizationId: string,
    year: number,
    month: number,
  ) {
    const db = getDb();
    const [biz] = await db
      .select()
      .from(businesses)
      .where(
        and(
          eq(businesses.id, businessId),
          eq(businesses.organizationId, organizationId),
        ),
      )
      .limit(1);
    if (!biz) return null;

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const [newCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(
        and(
          eq(customers.businessId, businessId),
          gte(customers.createdAt, start),
          lte(customers.createdAt, end),
        ),
      );

    const [repeatResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(
        and(
          eq(customers.businessId, businessId),
          gte(customers.lastVisitAt, start),
          lte(customers.lastVisitAt, end),
          lte(customers.createdAt, start),
        ),
      );

    return {
      year,
      month,
      newCustomers: newCount?.count ?? 0,
      repeatCustomers: repeatResult?.count ?? 0,
      repeatVisits: repeatResult?.count ?? 0,
    };
  }
}
