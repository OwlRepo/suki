import { Injectable, Logger } from "@nestjs/common";
import {
  authIdentities,
  organizations,
  subscriptions,
  users,
  getDb,
} from "@tyvera/database";
import { eq } from "drizzle-orm";
import { randomBytes, randomUUID, scryptSync } from "crypto";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function makePasswordHash(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

@Injectable()
export class AuthBootstrapService {
  private readonly logger = new Logger(AuthBootstrapService.name);

  private shouldBootstrap(): boolean {
    return String(process.env.AUTH_BOOTSTRAP_DEFAULT_ACCOUNT || "false").toLowerCase() === "true";
  }

  async ensureDefaultAccount(): Promise<void> {
    if (!this.shouldBootstrap()) return;

    const emailRaw = process.env.AUTH_BOOTSTRAP_EMAIL?.trim();
    const passwordRaw = process.env.AUTH_BOOTSTRAP_PASSWORD?.trim();
    const orgName = process.env.AUTH_BOOTSTRAP_ORG_NAME?.trim() || "Default Test Organization";

    if (!emailRaw || !passwordRaw) {
      this.logger.warn("AUTH bootstrap enabled but missing email/password env vars; skipping.");
      return;
    }

    if (process.env.NODE_ENV === "production") {
      this.logger.warn("AUTH bootstrap enabled in production. Proceeding due to explicit flag.");
    }

    const email = normalizeEmail(emailRaw);
    const db = getDb();

    const [existing] = await db
      .select({ id: authIdentities.id })
      .from(authIdentities)
      .where(eq(authIdentities.email, email))
      .limit(1);

    if (existing) {
      this.logger.log(`Default account already exists for ${email}.`);
      return;
    }

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const passwordHash = makePasswordHash(passwordRaw);
    const syntheticClerkId = `local_${randomUUID()}`;

    await db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizations)
        .values({ name: orgName, currentPlan: "free" })
        .returning();
      if (!org) throw new Error("Failed to create bootstrap organization");

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
          clerkId: syntheticClerkId,
          organizationId: org.id,
          role: "owner",
          email,
        })
        .returning({ id: users.id });

      if (!user) throw new Error("Failed to create bootstrap user");

      await tx.insert(authIdentities).values({
        userId: user.id,
        email,
        passwordHash,
        emailVerifiedAt: now,
      });
    });

    this.logger.log(`Default test account bootstrapped for ${email}.`);
  }
}
