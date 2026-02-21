import { Injectable, ForbiddenException } from "@nestjs/common";
import { getDb } from "@suki/database";
import { deals, businesses } from "@suki/database";
import { eq } from "drizzle-orm";

@Injectable()
export class DealsService {
  private async assertBusinessAccess(businessId: string, organizationId: string) {
    const db = getDb();
    const [b] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);
    if (!b || b.organizationId !== organizationId) {
      throw new ForbiddenException("Business not found");
    }
  }

  async list(businessId: string, organizationId: string) {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    const list = await db
      .select()
      .from(deals)
      .where(eq(deals.businessId, businessId));
    return list;
  }

  async create(
    organizationId: string,
    data: {
      businessId: string;
      customerId?: string;
      title: string;
      stage: string;
      amount?: number;
      ownerUserId?: string;
    },
  ) {
    await this.assertBusinessAccess(data.businessId, organizationId);
    const db = getDb();
    const [deal] = await db
      .insert(deals)
      .values({
        businessId: data.businessId,
        customerId: data.customerId ?? null,
        title: data.title,
        stage: data.stage,
        amount: data.amount ?? null,
        ownerUserId: data.ownerUserId ?? null,
      })
      .returning();
    return deal;
  }

  async updateStage(
    dealId: string,
    organizationId: string,
    newStage: string,
    businessId: string,
  ) {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    const [deal] = await db
      .update(deals)
      .set({ stage: newStage, updatedAt: new Date() })
      .where(eq(deals.id, dealId))
      .returning();
    if (!deal || deal.businessId !== businessId)
      throw new ForbiddenException("Deal not found");
    return deal;
  }
}
