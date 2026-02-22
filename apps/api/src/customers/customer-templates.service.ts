import { Injectable, ForbiddenException, NotFoundException } from "@nestjs/common";
import { getDb } from "@suki/database";
import {
  customerDescriptionTemplates,
  businessDefaultDescriptionTemplates,
  businesses,
} from "@suki/database";
import { eq, and, or, isNull, asc } from "drizzle-orm";

export type TemplateFieldConfig = { key: string; label: string; placeholder?: string };

const BUILTIN_DEFAULT_FIELDS_BY_TYPE: Record<string, TemplateFieldConfig[]> = {
  salon: [
    { key: "source", label: "How did they find you?", placeholder: "e.g. Facebook, walk-in" },
    { key: "preferences", label: "Service preferences", placeholder: "e.g. preferred stylist, hair type" },
    { key: "notes", label: "Additional notes", placeholder: "" },
  ],
  clinic: [
    { key: "referral", label: "Referral source", placeholder: "e.g. Doctor, walk-in" },
    { key: "medical_notes", label: "Medical notes", placeholder: "Brief, non-sensitive notes" },
    { key: "preferences", label: "Preferences", placeholder: "" },
  ],
  restaurant: [
    { key: "source", label: "How did they find you?", placeholder: "e.g. Social media, referral" },
    { key: "dietary", label: "Dietary preferences", placeholder: "e.g. Vegetarian, allergies" },
    { key: "notes", label: "Additional notes", placeholder: "" },
  ],
  gym: [
    { key: "source", label: "Referral source", placeholder: "e.g. Friend, online" },
    { key: "goals", label: "Fitness goals", placeholder: "e.g. Weight loss, strength" },
    { key: "notes", label: "Additional notes", placeholder: "" },
  ],
  spa: [
    { key: "source", label: "How did they find you?", placeholder: "e.g. Recommendation" },
    { key: "preferences", label: "Treatment preferences", placeholder: "e.g. Preferred therapist" },
    { key: "notes", label: "Additional notes", placeholder: "" },
  ],
};

const FALLBACK_FIELDS: TemplateFieldConfig[] = [
  { key: "source", label: "Source", placeholder: "How did they find you?" },
  { key: "preferences", label: "Preferences", placeholder: "" },
  { key: "notes", label: "Notes", placeholder: "" },
];

export function getBuiltinDefaultFields(businessType: string): TemplateFieldConfig[] {
  return BUILTIN_DEFAULT_FIELDS_BY_TYPE[businessType] ?? FALLBACK_FIELDS;
}

@Injectable()
export class CustomerTemplatesService {
  async list(
    organizationId: string,
    opts: { businessId?: string; businessType?: string },
  ) {
    const db = getDb();

    const conditions = [eq(customerDescriptionTemplates.organizationId, organizationId)];

    if (opts.businessId) {
      conditions.push(
        or(
          eq(customerDescriptionTemplates.businessId, opts.businessId),
          isNull(customerDescriptionTemplates.businessId),
        )!,
      );
    }

    if (opts.businessType) {
      conditions.push(
        or(
          eq(customerDescriptionTemplates.businessType, opts.businessType),
          isNull(customerDescriptionTemplates.businessType),
        )!,
      );
    }

    const rows = await db
      .select()
      .from(customerDescriptionTemplates)
      .where(and(...conditions))
      .orderBy(asc(customerDescriptionTemplates.sortOrder));

    const builtinFields = getBuiltinDefaultFields(opts.businessType ?? "");
    const builtinDefault = {
      id: "default",
      name: "Default",
      organizationId,
      businessId: null,
      businessType: null,
      fieldsConfig: builtinFields,
      sortOrder: -1,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    return { templates: [builtinDefault, ...rows] };
  }

  async create(
    organizationId: string,
    data: {
      name: string;
      businessId?: string;
      businessType?: string;
      fieldsConfig: TemplateFieldConfig[];
      sortOrder?: number;
    },
  ) {
    if (data.businessId) await this.assertBusinessAccess(data.businessId, organizationId);

    const db = getDb();
    const [created] = await db
      .insert(customerDescriptionTemplates)
      .values({
        organizationId,
        businessId: data.businessId ?? null,
        businessType: data.businessType?.trim() || null,
        name: data.name.trim(),
        fieldsConfig: data.fieldsConfig ?? [],
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();
    return { template: created! };
  }

  async getById(id: string, organizationId: string) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(customerDescriptionTemplates)
      .where(
        and(
          eq(customerDescriptionTemplates.id, id),
          eq(customerDescriptionTemplates.organizationId, organizationId),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Template not found");
    return { template: row };
  }

  async update(
    id: string,
    organizationId: string,
    data: {
      name?: string;
      businessType?: string;
      fieldsConfig?: TemplateFieldConfig[];
      sortOrder?: number;
    },
  ) {
    await this.getById(id, organizationId);
    const db = getDb();
    const [updated] = await db
      .update(customerDescriptionTemplates)
      .set({
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.businessType !== undefined && {
          businessType: data.businessType?.trim() || null,
        }),
        ...(data.fieldsConfig !== undefined && { fieldsConfig: data.fieldsConfig }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        updatedAt: new Date(),
      })
      .where(eq(customerDescriptionTemplates.id, id))
      .returning();
    return { template: updated! };
  }

  async delete(id: string, organizationId: string) {
    await this.getById(id, organizationId);
    const db = getDb();
    await db.delete(customerDescriptionTemplates).where(eq(customerDescriptionTemplates.id, id));
    return { success: true };
  }

  async getDefaultTemplate(businessId: string, organizationId: string) {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();

    const [biz] = await db
      .select({ businessType: businesses.businessType })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);
    const businessType = biz?.businessType ?? "";

    const [row] = await db
      .select({
        templateId: businessDefaultDescriptionTemplates.templateId,
      })
      .from(businessDefaultDescriptionTemplates)
      .where(eq(businessDefaultDescriptionTemplates.businessId, businessId))
      .limit(1);

    if (!row) {
      const builtinFields = getBuiltinDefaultFields(businessType);
      return {
        template: {
          id: "default",
          name: "Default",
          organizationId,
          businessId: null,
          businessType: null,
          fieldsConfig: builtinFields,
          sortOrder: 0,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
      };
    }

    const [template] = await db
      .select()
      .from(customerDescriptionTemplates)
      .where(eq(customerDescriptionTemplates.id, row.templateId))
      .limit(1);
    return { template: template ?? null };
  }

  async setDefaultTemplate(
    businessId: string,
    organizationId: string,
    templateId: string | null,
  ) {
    await this.assertBusinessAccess(businessId, organizationId);
    if (templateId) {
      await this.getById(templateId, organizationId);
    }

    const db = getDb();
    if (templateId === null) {
      await db
        .delete(businessDefaultDescriptionTemplates)
        .where(eq(businessDefaultDescriptionTemplates.businessId, businessId));
    } else {
      await db
        .insert(businessDefaultDescriptionTemplates)
        .values({
          businessId,
          templateId,
        })
        .onConflictDoUpdate({
          target: businessDefaultDescriptionTemplates.businessId,
          set: { templateId, updatedAt: new Date() },
        });
    }
    return { success: true };
  }

  private async assertBusinessAccess(businessId: string, organizationId: string) {
    const db = getDb();
    const [biz] = await db
      .select()
      .from(businesses)
      .where(
        and(
          eq(businesses.id, businessId),
          eq(businesses.organizationId, organizationId),
        ),
      )
      .limit(1);
    if (!biz) throw new ForbiddenException("Business not found");
  }
}
