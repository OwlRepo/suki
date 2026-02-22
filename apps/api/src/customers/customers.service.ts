import { Injectable, ForbiddenException, ConflictException } from "@nestjs/common";
import { getDb } from "@suki/database";
import { customers, businesses, messageEvents } from "@suki/database";
import { eq, and, ilike, like, or, sql, desc, gte, lt, isNull } from "drizzle-orm";
import { AutomationSendService } from "../automation/automation-send.service";

const DEFAULT_LOYALTY_THRESHOLD = 5;

function parseTags(tags: string | null | undefined): string | null {
  if (!tags || typeof tags !== "string") return null;
  const trimmed = tags.trim();
  return trimmed ? trimmed : null;
}

@Injectable()
export class CustomersService {
  constructor(private readonly automationSend: AutomationSendService) {}
  async create(
    businessId: string,
    organizationId: string,
    data: {
      name: string;
      mobile?: string;
      email?: string;
      notes?: string;
      preferences?: string;
      tags?: string;
      confirmDuplicate?: boolean;
    },
  ) {
    const matches = await this.checkDuplicateBeforeCreate(businessId, organizationId, {
      name: data.name,
      mobile: data.mobile,
    });
    if (matches.length > 0 && !data.confirmDuplicate) {
      throw new ConflictException({
        duplicateWarning: true,
        matches: matches.map((m) => ({ id: m.id, name: m.name, reason: m.reason })),
      });
    }

    const tagsToUse =
      matches.length > 0 && data.confirmDuplicate
        ? this.appendDuplicateTag(data.tags)
        : parseTags(data.tags);

    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    const [c] = await db
      .insert(customers)
      .values({
        businessId,
        name: data.name.trim(),
        mobile: data.mobile?.trim() || null,
        email: data.email?.trim() || null,
        notes: data.notes?.trim() || null,
        preferences: data.preferences?.trim() || null,
        tags: tagsToUse,
      })
      .returning();
    return c!;
  }

  async list(
    businessId: string,
    organizationId: string,
    opts?: { search?: string; tag?: string; limit?: number; offset?: number },
  ) {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    let conditions = opts?.search?.trim()
      ? and(
          eq(customers.businessId, businessId),
          ilike(customers.name, `%${opts.search.trim()}%`),
        )
      : eq(customers.businessId, businessId);
    if (opts?.tag?.trim()) {
      const tag = opts.tag.trim();
      conditions = and(
        conditions,
        or(
          eq(customers.tags, tag),
          like(customers.tags, tag + ",%"),
          like(customers.tags, "%," + tag),
          like(customers.tags, "%,%" + tag + ",%"),
        ),
      );
    }
    const limit = Math.min(opts?.limit ?? 50, 100);
    const offset = opts?.offset ?? 0;
    const list = await db
      .select()
      .from(customers)
      .where(conditions)
      .orderBy(desc(customers.updatedAt))
      .limit(limit)
      .offset(offset);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(conditions);
    return { customers: list, total: count };
  }

  async getMessageHistory(customerId: string, organizationId: string, limit = 50) {
    const customer = await this.findById(customerId, organizationId);
    if (!customer) return [];
    const db = getDb();
    const rows = await db
      .select({
        id: messageEvents.id,
        channel: messageEvents.channel,
        purpose: messageEvents.purpose,
        status: messageEvents.status,
        deliveryStatus: messageEvents.deliveryStatus,
        failureReason: messageEvents.failureReason,
        sentAt: messageEvents.sentAt,
        createdAt: messageEvents.createdAt,
      })
      .from(messageEvents)
      .where(eq(messageEvents.customerId, customerId))
      .orderBy(desc(messageEvents.createdAt))
      .limit(Math.min(limit, 100));
    return rows.map((r) => ({
      id: r.id,
      channel: r.channel,
      purpose: r.purpose,
      status: r.status,
      deliveryStatus: r.deliveryStatus ?? undefined,
      failureReason: r.failureReason ?? undefined,
      sentAt: r.sentAt?.toISOString() ?? undefined,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async findById(id: string, organizationId: string) {
    const db = getDb();
    const [c] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1);
    if (!c) return null;
    await this.assertBusinessAccess(c.businessId, organizationId);
    return c;
  }

  async update(
    id: string,
    organizationId: string,
    data: { name?: string; mobile?: string; email?: string; notes?: string; preferences?: string; tags?: string },
  ) {
    const existing = await this.findById(id, organizationId);
    if (!existing) return null;
    const db = getDb();
    const [updated] = await db
      .update(customers)
      .set({
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.mobile !== undefined && { mobile: data.mobile?.trim() || null }),
        ...(data.email !== undefined && { email: data.email?.trim() || null }),
        ...(data.notes !== undefined && { notes: data.notes?.trim() || null }),
        ...(data.preferences !== undefined && {
          preferences: data.preferences?.trim() || null,
        }),
        ...(data.tags !== undefined && { tags: parseTags(data.tags) }),
        updatedAt: new Date(),
      })
      .where(eq(customers.id, id))
      .returning();
    return updated!;
  }

  async delete(id: string, organizationId: string) {
    const existing = await this.findById(id, organizationId);
    if (!existing) return false;
    const db = getDb();
    await db.delete(customers).where(eq(customers.id, id));
    return true;
  }

  async countByFilter(
    businessId: string,
    organizationId: string,
    opts?: { minVisits?: number; maxInactiveDays?: number },
  ): Promise<number> {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    const base = eq(customers.businessId, businessId);
    const parts: ReturnType<typeof eq>[] = [base];
    if (opts?.minVisits != null && opts.minVisits > 0) {
      parts.push(gte(customers.visitCount, opts.minVisits));
    }
    if (opts?.maxInactiveDays != null && opts.maxInactiveDays >= 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - opts.maxInactiveDays);
      parts.push(or(lt(customers.lastVisitAt, cutoff), isNull(customers.lastVisitAt))!);
    }
    const conditions = parts.length > 1 ? and(...parts) : base;
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(conditions);
    return row?.count ?? 0;
  }

  async stampVisit(id: string, organizationId: string) {
    const existing = await this.findById(id, organizationId);
    if (!existing) return null;
    const db = getDb();
    const now = new Date();
    const newVisitCount = existing.visitCount + 1;
    const [updated] = await db
      .update(customers)
      .set({
        visitCount: newVisitCount,
        lastVisitAt: now,
        updatedAt: now,
      })
      .where(eq(customers.id, id))
      .returning();
    const customer = updated!;

    void this.automationSend
      .sendPostVisitFollowup(organizationId, existing.businessId, id)
      .catch(() => {});
    if (newVisitCount >= DEFAULT_LOYALTY_THRESHOLD) {
      void this.automationSend
        .sendLoyaltyUnlock(organizationId, existing.businessId, id)
        .catch(() => {});
    }

    return customer;
  }

  async findDuplicateCandidates(
    businessId: string,
    organizationId: string,
    opts?: { limit?: number },
  ) {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    const limit = Math.min(opts?.limit ?? 20, 50);
    const list = await db
      .select()
      .from(customers)
      .where(eq(customers.businessId, businessId))
      .orderBy(desc(customers.updatedAt));

    const candidates: Array<{
      customer: (typeof list)[0];
      matches: Array<{ customer: (typeof list)[0]; confidence: number }>;
    }> = [];

    const normalized = (s: string | null | undefined) =>
      (s ?? "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

    const seen = new Set<string>();
    for (const c of list) {
      if (seen.has(c.id)) continue;
      const cName = normalized(c.name);
      const cMobile = normalized(c.mobile);
      if (!cName && !cMobile) continue;

      const matches: Array<{ customer: (typeof list)[0]; confidence: number }> = [];
      for (const other of list) {
        if (other.id === c.id) continue;
        const oName = normalized(other.name);
        const oMobile = normalized(other.mobile);

        let score = 0;
        if (cName && oName && cName === oName) score += 80;
        else if (cName && oName && cName.includes(oName)) score += 50;
        else if (cName && oName && oName.includes(cName)) score += 50;
        if (cMobile && oMobile && cMobile === oMobile) score += 90;
        else if (cMobile && oMobile && cMobile.replace(/\D/g, "") === oMobile.replace(/\D/g, ""))
          score += 85;

        if (score >= 50) matches.push({ customer: other, confidence: Math.min(score, 100) });
      }
      if (matches.length > 0) {
        candidates.push({ customer: c, matches });
        seen.add(c.id);
        matches.forEach((m) => seen.add(m.customer.id));
        if (candidates.length >= limit) break;
      }
    }
    return { candidates };
  }

  /**
   * Check if a customer with the given name and/or mobile already exists.
   * Used before create to warn user and optionally proceed with duplicate tag.
   */
  async checkDuplicateBeforeCreate(
    businessId: string,
    organizationId: string,
    data: { name: string; mobile?: string },
  ): Promise<Array<{ id: string; name: string; reason: "name" | "mobile" | "both" }>> {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    const existing = await db
      .select({ id: customers.id, name: customers.name, mobile: customers.mobile })
      .from(customers)
      .where(eq(customers.businessId, businessId));

    const normalizedName = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
    const normalizeMobile = (m: string | null | undefined) =>
      (m ?? "").replace(/\D/g, "").slice(-10);

    const matches: Array<{ id: string; name: string; reason: "name" | "mobile" | "both" }> = [];
    const inputName = normalizedName(data.name);
    const inputMobile = data.mobile ? normalizeMobile(data.mobile) : null;

    for (const ex of existing) {
      const nameMatch = inputName && ex.name && normalizedName(ex.name) === inputName;
      const mobileMatch =
        inputMobile && ex.mobile && normalizeMobile(ex.mobile) === inputMobile;

      if (nameMatch && mobileMatch) {
        matches.push({ id: ex.id, name: ex.name!, reason: "both" });
        break;
      }
      if (mobileMatch) {
        matches.push({ id: ex.id, name: ex.name!, reason: "mobile" });
        break;
      }
      if (nameMatch) {
        matches.push({ id: ex.id, name: ex.name!, reason: "name" });
        break;
      }
    }
    return matches;
  }

  private appendDuplicateTag(tags: string | null | undefined): string | null {
    const base = parseTags(tags);
    if (!base) return "duplicate";
    if (base.toLowerCase().includes("duplicate")) return base;
    return `${base},duplicate`;
  }

  private async assertBusinessAccess(businessId: string, organizationId: string) {
    const db = getDb();
    const [biz] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);
    if (!biz || biz.organizationId !== organizationId) {
      throw new ForbiddenException("Business not found");
    }
  }
}
