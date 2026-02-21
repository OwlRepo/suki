import { Injectable, ForbiddenException } from "@nestjs/common";
import { getDb } from "@suki/database";
import { users, businesses } from "@suki/database";
import { eq, sql } from "drizzle-orm";

@Injectable()
export class WorkspaceService {
  async getWorkspace(userId: string, organizationId: string) {
    const db = getDb();
    const columnCheck = await db.execute(sql<{ activeBusinessIdExists: boolean }>`
      select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'users'
          and column_name = 'active_business_id'
      ) as "activeBusinessIdExists"
    `);
    const activeBusinessIdExists = Boolean(
      (columnCheck as Array<{ activeBusinessIdExists?: unknown }>)[0]
        ?.activeBusinessIdExists,
    );

    const [user] = activeBusinessIdExists
      ? await db
          .select({ id: users.id, activeBusinessId: users.activeBusinessId })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1)
      : await db
          .select({ id: users.id, activeBusinessId: sql<string | null>`null` })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
    if (!user) return { activeBusinessId: null, businesses: [] };

    const orgBusinesses = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        crmMode: businesses.crmMode,
        workflowProfile: businesses.workflowProfile,
      })
      .from(businesses)
      .where(eq(businesses.organizationId, organizationId));

    let activeBusinessId = user.activeBusinessId;
    if (
      activeBusinessId &&
      !orgBusinesses.some((b) => b.id === activeBusinessId)
    ) {
      activeBusinessId = null;
    }
    if (!activeBusinessId && orgBusinesses.length > 0) {
      activeBusinessId = orgBusinesses[0].id;
      if (activeBusinessIdExists) {
        await db
          .update(users)
          .set({ activeBusinessId, updatedAt: new Date() })
          .where(eq(users.id, userId));
      }
    }

    return {
      activeBusinessId,
      businesses: orgBusinesses,
    };
  }

  async setWorkspace(
    userId: string,
    organizationId: string,
    businessId: string,
  ) {
    const db = getDb();
    const [biz] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);
    if (!biz || biz.organizationId !== organizationId) {
      throw new ForbiddenException("Business not found");
    }
    const columnCheck = await db.execute(sql<{ activeBusinessIdExists: boolean }>`
      select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'users'
          and column_name = 'active_business_id'
      ) as "activeBusinessIdExists"
    `);
    const activeBusinessIdExists = Boolean(
      (columnCheck as Array<{ activeBusinessIdExists?: unknown }>)[0]
        ?.activeBusinessIdExists,
    );
    if (activeBusinessIdExists) {
      await db
        .update(users)
        .set({ activeBusinessId: businessId, updatedAt: new Date() })
        .where(eq(users.id, userId));
    }
    return { activeBusinessId: businessId };
  }
}
