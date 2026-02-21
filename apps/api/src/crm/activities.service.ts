import { Injectable, ForbiddenException } from "@nestjs/common";
import { getDb } from "@suki/database";
import { activities, businesses } from "@suki/database";
import { eq, and } from "drizzle-orm";

@Injectable()
export class ActivitiesService {
  async list(businessId: string, organizationId: string, opts?: { customerId?: string; dealId?: string }) {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    let conditions = eq(activities.businessId, businessId);
    if (opts?.customerId) {
      conditions = and(conditions, eq(activities.customerId, opts.customerId))!;
    }
    if (opts?.dealId) {
      conditions = and(conditions, eq(activities.dealId, opts.dealId))!;
    }
    return db.select().from(activities).where(conditions).orderBy(activities.createdAt);
  }

  async create(
    organizationId: string,
    data: {
      businessId: string;
      customerId?: string;
      dealId?: string;
      type: string;
      subject?: string;
      notes?: string;
      createdByUserId?: string;
    },
  ) {
    await this.assertBusinessAccess(data.businessId, organizationId);
    const db = getDb();
    const [a] = await db
      .insert(activities)
      .values({
        businessId: data.businessId,
        customerId: data.customerId ?? null,
        dealId: data.dealId ?? null,
        type: data.type,
        subject: data.subject ?? null,
        notes: data.notes ?? null,
        createdByUserId: data.createdByUserId ?? null,
      })
      .returning();
    return a!;
  }

  private async assertBusinessAccess(businessId: string, organizationId: string) {
    const db = getDb();
    const [b] = await db
      .select()
      .from(businesses)
      .where(
        and(
          eq(businesses.id, businessId),
          eq(businesses.organizationId, organizationId),
        ),
      )
      .limit(1);
    if (!b) throw new ForbiddenException("Business not found");
  }
}
