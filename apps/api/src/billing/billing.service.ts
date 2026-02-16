import { Injectable } from "@nestjs/common";
import { getDb } from "@suki/database";
import { subscriptions } from "@suki/database";
import { eq, desc } from "drizzle-orm";

@Injectable()
export class BillingService {
  async getSubscription(organizationId: string) {
    const db = getDb();
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .orderBy(desc(subscriptions.currentPeriodEnd))
      .limit(1);
    return sub ?? null;
  }
}
