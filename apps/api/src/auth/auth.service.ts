import { Injectable } from "@nestjs/common";
import { verifyToken } from "@clerk/backend";
import { getDb } from "@suki/database";
import { organizations, users, subscriptions } from "@suki/database";
import { eq, sql } from "drizzle-orm";

@Injectable()
export class AuthService {
  async syncUser(clerkId: string, email?: string) {
    const db = getDb();
    const [existing] = await db
      .select({
        id: users.id,
        clerkId: users.clerkId,
        organizationId: users.organizationId,
        role: users.role,
        email: users.email,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);
    if (existing) {
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, existing.organizationId))
        .limit(1);
      return { user: existing, organization: org, isNew: false };
    }

    const orgRes = await db
      .insert(organizations)
      .values({ name: "My Organization" })
      .returning();
    const org = orgRes[0];
    if (!org) throw new Error("Failed to create organization");

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    await db.insert(subscriptions).values({
      organizationId: org.id,
      planType: "starter",
      status: "trialing",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    });

    let user:
      | {
          id: string;
          clerkId: string;
          organizationId: string;
          role: "owner" | "staff";
          email: string | null;
          createdAt: Date;
          updatedAt: Date;
        }
      | undefined;
    try {
      const userRes = await db
        .insert(users)
        .values({
          clerkId,
          organizationId: org.id,
          role: "owner",
          email: email ?? null,
        })
        .returning({
          id: users.id,
          clerkId: users.clerkId,
          organizationId: users.organizationId,
          role: users.role,
          email: users.email,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        });
      user = userRes[0];
    } catch (error) {
      const err = error as { message?: string };
      const isMissingActiveBusinessColumn =
        (err.message ?? "").includes("active_business_id");
      if (!isMissingActiveBusinessColumn) {
        throw error;
      }
      const fallbackInsert = await db.execute(sql`
        insert into users (clerk_id, organization_id, role, email, created_at, updated_at)
        values (${clerkId}, ${org.id}, ${"owner"}, ${email ?? null}, now(), now())
        returning
          id,
          clerk_id as "clerkId",
          organization_id as "organizationId",
          role,
          email,
          created_at as "createdAt",
          updated_at as "updatedAt"
      `);
      const row = fallbackInsert[0] as Record<string, unknown> | undefined;
      user = row
        ? {
            id: String(row.id),
            clerkId: String(row.clerkId),
            organizationId: String(row.organizationId),
            role: (row.role === "staff" ? "staff" : "owner") as "owner" | "staff",
            email: (row.email as string | null) ?? null,
            createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(String(row.createdAt)),
            updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(String(row.updatedAt)),
          }
        : undefined;
    }
    if (!user) throw new Error("Failed to create user");
    return { user, organization: org, isNew: true };
  }

  async verifyToken(token: string): Promise<{ clerkId: string; email?: string } | null> {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) return null;
    try {
      const payload = await verifyToken(token, { secretKey });
      const sub = payload?.sub;
      if (!sub) return null;
      return {
        clerkId: sub,
        email: (payload as { email?: string }).email,
      };
    } catch {
      return null;
    }
  }
}
