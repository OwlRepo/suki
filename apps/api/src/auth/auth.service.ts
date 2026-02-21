import { Injectable } from "@nestjs/common";
import { verifyToken } from "@clerk/backend";
import { getDb } from "@suki/database";
import { organizations, users, subscriptions } from "@suki/database";
import { eq } from "drizzle-orm";

const UNIQUE_VIOLATION = "23505";
const USERS_CLERK_ID_CONSTRAINT = "users_clerk_id_unique";

@Injectable()
export class AuthService {
  async syncUser(clerkId: string, email?: string) {
    const db = getDb();

    try {
      return await db.transaction(async (tx) => {
        const [existing] = await tx
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
          const [org] = await tx
            .select()
            .from(organizations)
            .where(eq(organizations.id, existing.organizationId))
            .limit(1);
          return { user: existing, organization: org, isNew: false };
        }

        const [org] = await tx
          .insert(organizations)
          .values({ name: "My Organization" })
          .returning();
        if (!org) throw new Error("Failed to create organization");

        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEnd = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59
        );
        await tx.insert(subscriptions).values({
          organizationId: org.id,
          planType: "starter",
          status: "trialing",
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        });

        const [user] = await tx
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

        if (!user) throw new Error("Failed to create user");
        return { user, organization: org, isNew: true };
      });
    } catch (error) {
      const err = (error as { cause?: unknown })?.cause ?? error;
      const e = err as { code?: string; constraint?: string; constraint_name?: string; message?: string };
      const constraint = e.constraint ?? e.constraint_name;
      const isClerkIdConflict =
        e.code === UNIQUE_VIOLATION &&
        (constraint === USERS_CLERK_ID_CONSTRAINT || e.message?.includes("users_clerk_id"));

      if (isClerkIdConflict) {
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
      }

      throw error;
    }
  }

  async verifyToken(
    token: string
  ): Promise<{ clerkId: string; email?: string } | null> {
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
