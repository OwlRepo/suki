import { Injectable } from "@nestjs/common";
import { getDb } from "@suki/database";
import { organizations } from "@suki/database";
import { eq } from "drizzle-orm";
import type { OrgBillingStatus, PlanType } from "@suki/types";

export interface UpdateBillingInput {
  billingStatus?: OrgBillingStatus;
  currentPlan?: PlanType;
  trialStartsAt?: Date | null;
  trialEndsAt?: Date | null;
  nextBillingDueAt?: Date | null;
  manualBillingNotes?: string | null;
  accessEndsAt?: Date | null;
}

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

  async updateBilling(id: string, data: UpdateBillingInput) {
    const db = getDb();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.billingStatus !== undefined) updates.billingStatus = data.billingStatus;
    if (data.currentPlan !== undefined) updates.currentPlan = data.currentPlan;
    if (data.trialStartsAt !== undefined) updates.trialStartsAt = data.trialStartsAt;
    if (data.trialEndsAt !== undefined) updates.trialEndsAt = data.trialEndsAt;
    if (data.nextBillingDueAt !== undefined) updates.nextBillingDueAt = data.nextBillingDueAt;
    if (data.manualBillingNotes !== undefined) updates.manualBillingNotes = data.manualBillingNotes;
    if (data.accessEndsAt !== undefined) updates.accessEndsAt = data.accessEndsAt;
    const [updated] = await db
      .update(organizations)
      .set(updates)
      .where(eq(organizations.id, id))
      .returning();
    return updated;
  }
}
