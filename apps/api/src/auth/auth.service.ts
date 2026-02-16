import { Injectable } from "@nestjs/common";
import { verifyToken } from "@clerk/backend";
import { getDb } from "@suki/database";
import { organizations, users, subscriptions } from "@suki/database";
import { eq } from "drizzle-orm";

@Injectable()
export class AuthService {
  async syncUser(clerkId: string, email?: string) {
    const db = getDb();
    const [existing] = await db
      .select()
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

    const userRes = await db
      .insert(users)
      .values({
        clerkId,
        organizationId: org.id,
        role: "owner",
        email: email ?? null,
      })
      .returning();
    const user = userRes[0];
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
