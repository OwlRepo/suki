import { Injectable, ForbiddenException } from "@nestjs/common";
import { getDb } from "@tyvera/database";
import { dealStages, businesses } from "@tyvera/database";
import { eq, and } from "drizzle-orm";

@Injectable()
export class DealStagesService {
  async list(businessId: string, organizationId: string) {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    const rows = await db
      .select()
      .from(dealStages)
      .where(eq(dealStages.businessId, businessId))
      .orderBy(dealStages.sortOrder);
    // Deduplicate by name (keep first occurrence) — guard against any legacy duplicates
    const seen = new Set<string>();
    return rows.filter((r) => {
      if (seen.has(r.name)) return false;
      seen.add(r.name);
      return true;
    });
  }

  async create(organizationId: string, data: { businessId: string; name: string; sortOrder?: number }) {
    await this.assertBusinessAccess(data.businessId, organizationId);
    const db = getDb();
    const order = data.sortOrder ?? 0;
    const [s] = await db
      .insert(dealStages)
      .values({
        businessId: data.businessId,
        name: data.name,
        sortOrder: order,
      })
      .returning();
    return s!;
  }

  async ensureDefaults(businessId: string, organizationId: string) {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    const existing = await db
      .select()
      .from(dealStages)
      .where(eq(dealStages.businessId, businessId))
      .orderBy(dealStages.sortOrder);
    if (existing.length > 0) return existing;
    const defaults = ["New", "Qualified", "Proposal", "Negotiation", "Won", "Lost"];
    await db
      .insert(dealStages)
      .values(
        defaults.map((name, i) => ({
          businessId,
          name,
          sortOrder: i,
        })),
      )
      .onConflictDoNothing({ target: [dealStages.businessId, dealStages.name] });
    const list = await db
      .select()
      .from(dealStages)
      .where(eq(dealStages.businessId, businessId))
      .orderBy(dealStages.sortOrder);
    return list;
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
