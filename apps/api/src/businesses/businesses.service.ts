import { Injectable, ForbiddenException } from "@nestjs/common";
import { getDb } from "@suki/database";
import { businesses, organizations } from "@suki/database";
import { eq, sql } from "drizzle-orm";
import { PlanCapacityService } from "../common/plan-capacity.service";

@Injectable()
export class BusinessesService {
  constructor(private readonly planCapacity: PlanCapacityService) {}

  async countByOrganization(organizationId: string): Promise<number> {
    const db = getDb();
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(businesses)
      .where(eq(businesses.organizationId, organizationId));
    return row?.count ?? 0;
  }

  async create(
    organizationId: string,
    data: { name: string; businessType: string; workflowProfile?: string },
  ) {
    const db = getDb();
    const profile =
      data.workflowProfile && ["general", "service_scheduling", "project_lifecycle", "compliance_heavy"].includes(data.workflowProfile)
        ? data.workflowProfile
        : "general";

    const biz = await db.transaction(async (tx) => {
      await tx
        .select()
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .for("update");
      const [countRow] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(businesses)
        .where(eq(businesses.organizationId, organizationId));
      const currentCount = countRow?.count ?? 0;
      const maxAllowed = await this.planCapacity.getBusinessLimitByOrg(organizationId);
      if (currentCount >= maxAllowed) {
        throw new ForbiddenException("PLAN_BUSINESS_LIMIT_REACHED");
      }
      const [inserted] = await tx
        .insert(businesses)
        .values({
          organizationId,
          name: data.name,
          businessType: data.businessType,
          workflowProfile: profile,
        })
        .returning();
      return inserted;
    });

    return biz;
  }

  async listByOrganization(organizationId: string) {
    const db = getDb();
    return db
      .select()
      .from(businesses)
      .where(eq(businesses.organizationId, organizationId));
  }

  async findById(id: string) {
    const db = getDb();
    const [biz] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, id))
      .limit(1);
    return biz ?? null;
  }

  async update(id: string, data: { name?: string; businessType?: string }) {
    const db = getDb();
    const [updated] = await db
      .update(businesses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(businesses.id, id))
      .returning();
    return updated;
  }

  async updateCrmMode(
    id: string,
    organizationId: string,
    crmMode: "lite" | "full",
  ) {
    const plan = await this.planCapacity.getActivePlan(organizationId);
    if (plan === "starter") {
      throw new ForbiddenException("CRM_FULL_REQUIRES_UPGRADE");
    }
    const biz = await this.findById(id);
    if (!biz || biz.organizationId !== organizationId) {
      throw new ForbiddenException("Business not found");
    }
    const db = getDb();
    const [updated] = await db
      .update(businesses)
      .set({ crmMode, updatedAt: new Date() })
      .where(eq(businesses.id, id))
      .returning();
    return updated;
  }
}
