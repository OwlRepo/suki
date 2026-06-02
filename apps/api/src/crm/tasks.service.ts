import { Injectable, ForbiddenException } from "@nestjs/common";
import { getDb } from "@tyvera/database";
import { tasks, businesses } from "@tyvera/database";
import { eq, and, isNull } from "drizzle-orm";

@Injectable()
export class TasksService {
  async list(
    businessId: string,
    organizationId: string,
    opts?: { customerId?: string; dealId?: string; incompleteOnly?: boolean },
  ) {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    let conditions = eq(tasks.businessId, businessId);
    if (opts?.customerId) {
      conditions = and(conditions, eq(tasks.customerId, opts.customerId))!;
    }
    if (opts?.dealId) {
      conditions = and(conditions, eq(tasks.dealId, opts.dealId))!;
    }
    if (opts?.incompleteOnly) {
      conditions = and(conditions, isNull(tasks.completedAt))!;
    }
    return db.select().from(tasks).where(conditions).orderBy(tasks.dueAt);
  }

  async create(
    organizationId: string,
    data: {
      businessId: string;
      customerId?: string;
      dealId?: string;
      title: string;
      dueAt?: Date;
      assigneeUserId?: string;
    },
  ) {
    await this.assertBusinessAccess(data.businessId, organizationId);
    const db = getDb();
    const [t] = await db
      .insert(tasks)
      .values({
        businessId: data.businessId,
        customerId: data.customerId ?? null,
        dealId: data.dealId ?? null,
        title: data.title,
        dueAt: data.dueAt ?? null,
        assigneeUserId: data.assigneeUserId ?? null,
      })
      .returning();
    return t!;
  }

  async complete(id: string, organizationId: string) {
    const existing = await this.findById(id, organizationId);
    if (!existing) throw new ForbiddenException("Task not found");
    const db = getDb();
    const [updated] = await db
      .update(tasks)
      .set({ completedAt: new Date(), updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return updated!;
  }

  async findById(id: string, organizationId: string) {
    const db = getDb();
    const [t] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    if (!t) return null;
    await this.assertBusinessAccess(t.businessId, organizationId);
    return t;
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
