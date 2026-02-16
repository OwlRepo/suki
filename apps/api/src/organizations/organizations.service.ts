import { Injectable } from "@nestjs/common";
import { getDb } from "@suki/database";
import { organizations } from "@suki/database";
import { eq } from "drizzle-orm";

@Injectable()
export class OrganizationsService {
  async findById(id: string) {
    const db = getDb();
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);
    return org ?? null;
  }

  async update(id: string, data: { name?: string }) {
    const db = getDb();
    const [updated] = await db
      .update(organizations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
    return updated;
  }
}
