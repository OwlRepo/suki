import { Injectable } from "@nestjs/common";
import { getDb } from "@suki/database";
import { businesses } from "@suki/database";
import { eq } from "drizzle-orm";

@Injectable()
export class BusinessesService {
  async create(organizationId: string, data: { name: string; businessType: string }) {
    const db = getDb();
    const [biz] = await db
      .insert(businesses)
      .values({
        organizationId,
        name: data.name,
        businessType: data.businessType,
      })
      .returning();
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
}
