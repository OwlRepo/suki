import { Injectable, ForbiddenException } from "@nestjs/common";
import { getDb } from "@suki/database";
import { customFields, businesses } from "@suki/database";
import { eq, and } from "drizzle-orm";

@Injectable()
export class CustomFieldsService {
  async list(businessId: string, organizationId: string, entityType?: string) {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    let conditions = eq(customFields.businessId, businessId);
    if (entityType) {
      conditions = and(conditions, eq(customFields.entityType, entityType))!;
    }
    return db
      .select()
      .from(customFields)
      .where(conditions)
      .orderBy(customFields.sortOrder);
  }

  async create(
    organizationId: string,
    data: {
      businessId: string;
      entityType: string;
      fieldName: string;
      fieldType?: string;
      sortOrder?: number;
    },
  ) {
    await this.assertBusinessAccess(data.businessId, organizationId);
    const db = getDb();
    const [f] = await db
      .insert(customFields)
      .values({
        businessId: data.businessId,
        entityType: data.entityType,
        fieldName: data.fieldName,
        fieldType: data.fieldType ?? "text",
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();
    return f!;
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
