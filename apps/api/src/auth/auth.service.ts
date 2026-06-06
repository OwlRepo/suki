import { Injectable } from "@nestjs/common";
import { getDb } from "@tyvera/database";
import {
  authIdentities,
  authOtpChallenges,
  authSessions,
  onboardingProgress,
  organizations,
  subscriptions,
  users,
} from "@tyvera/database";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { FeatureFlagsService } from "../common/feature-flags.service";

const OTP_PURPOSE_SIGN_UP = "sign_up";
const OTP_PURPOSE_PASSWORD_RESET = "password_reset";
const OTP_TTL_MINUTES = Number(process.env.AUTH_OTP_TTL_MINUTES || 10);
const SESSION_TTL_DAYS = Number(process.env.AUTH_SESSION_TTL_DAYS || 30);
const ONBOARDING_COMPLETE_STEP = 7;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function makePasswordHash(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 64).toString("hex");
  return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(actual, "hex"));
}

@Injectable()
export class AuthService {
  constructor(_featureFlags: FeatureFlagsService) {}

  private async sendOtpEmail(email: string, code: string, purpose: "sign_up" | "password_reset" = "sign_up"): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.RESEND_FROM_EMAIL?.trim();
    if (!apiKey || !from) return;

    const subject =
      purpose === "password_reset"
        ? "Reset your Tyvera password"
        : "Your Tyvera verification code";
    const intro =
      purpose === "password_reset"
        ? "Use this code to reset your Tyvera password"
        : "Your verification code is";

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: email,
        subject,
        html: `<p>${intro} <strong>${code}</strong>.</p><p>This expires in ${OTP_TTL_MINUTES} minutes.</p>`,
      }),
    }).catch(() => undefined);
  }

  private async createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const db = getDb();
    const token = randomBytes(32).toString("hex");
    const tokenHash = hashValue(token);
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

    await db.insert(authSessions).values({
      userId,
      tokenHash,
      expiresAt,
    });

    return { token, expiresAt };
  }

  private async findUserByEmail(email: string) {
    const db = getDb();
    const normalized = normalizeEmail(email);

    const [identity] = await db
      .select()
      .from(authIdentities)
      .where(eq(authIdentities.email, normalized))
      .limit(1);

    if (!identity) return null;

    const [user] = await db
      .select({
        id: users.id,
        clerkId: users.clerkId,
        organizationId: users.organizationId,
        role: users.role,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, identity.userId))
      .limit(1);

    if (!user) return null;
    return { user, identity };
  }

  private async getPostLoginRedirectTo(user: { id: string; organizationId: string }) {
    const db = getDb();
    const [progress] = await db
      .select({ currentStep: onboardingProgress.currentStep })
      .from(onboardingProgress)
      .where(
        and(
          eq(onboardingProgress.organizationId, user.organizationId),
          eq(onboardingProgress.userId, user.id),
        ),
      )
      .limit(1);

    return progress && progress.currentStep >= ONBOARDING_COMPLETE_STEP
      ? "/dashboard"
      : "/onboarding";
  }

  async startOtp(email: string, purpose: "sign_up" | "password_reset") {
    const db = getDb();
    const normalized = normalizeEmail(email);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = hashValue(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await db.insert(authOtpChallenges).values({
      email: normalized,
      purpose,
      codeHash,
      attempts: 0,
      maxAttempts: Number(process.env.AUTH_OTP_MAX_ATTEMPTS || 3),
      expiresAt,
    });

    await this.sendOtpEmail(normalized, code, purpose);
    return { ok: true };
  }

  async startPasswordReset(email: string) {
    const existing = await this.findUserByEmail(email);
    if (!existing) return { ok: true };
    return this.startOtp(email, OTP_PURPOSE_PASSWORD_RESET);
  }

  async verifyOtpAndSignUp(email: string, code: string, password: string) {
    const db = getDb();
    const normalized = normalizeEmail(email);
    const now = new Date();

    if (!password || password.length < 8) {
      return { ok: false, message: "Password must be at least 8 characters" };
    }

    const [challenge] = await db
      .select()
      .from(authOtpChallenges)
      .where(
        and(
          eq(authOtpChallenges.email, normalized),
          eq(authOtpChallenges.purpose, OTP_PURPOSE_SIGN_UP),
          isNull(authOtpChallenges.consumedAt),
        ),
      )
      .orderBy(desc(authOtpChallenges.createdAt))
      .limit(1);

    if (!challenge || challenge.expiresAt < now) {
      return { ok: false, message: "Code expired" };
    }

    if (challenge.codeHash !== hashValue(code.trim())) {
      await db
        .update(authOtpChallenges)
        .set({ attempts: challenge.attempts + 1, updatedAt: now })
        .where(eq(authOtpChallenges.id, challenge.id));
      return { ok: false, message: "Invalid code" };
    }

    const existing = await this.findUserByEmail(normalized);
    if (existing) {
      return { ok: false, message: "Account already exists" };
    }

    const passwordHash = makePasswordHash(password);
    const org = await db.transaction(async (tx) => {
      const [newOrg] = await tx
        .insert(organizations)
        .values({ name: "My Organization", currentPlan: "free" })
        .returning();
      if (!newOrg) throw new Error("Failed to create organization");

      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      await tx.insert(subscriptions).values({
        organizationId: newOrg.id,
        planType: "starter",
        status: "trialing",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      });

      const syntheticClerkId = `local_${randomUUID()}`;
      const [newUser] = await tx
        .insert(users)
        .values({
          clerkId: syntheticClerkId,
          organizationId: newOrg.id,
          role: "owner",
          email: normalized,
        })
        .returning({ id: users.id });

      if (!newUser) throw new Error("Failed to create user");

      await tx.insert(authIdentities).values({
        userId: newUser.id,
        email: normalized,
        passwordHash,
        emailVerifiedAt: now,
      });

      return { userId: newUser.id };
    });

    await db
      .update(authOtpChallenges)
      .set({ consumedAt: now, updatedAt: now })
      .where(eq(authOtpChallenges.id, challenge.id));

    const session = await this.createSession(org.userId);
    return { ok: true, session };
  }

  async signInWithPassword(email: string, password: string) {
    const found = await this.findUserByEmail(email);
    if (!found || !found.identity.passwordHash) {
      return { ok: false, message: "Invalid credentials" };
    }
    if (!verifyPassword(password, found.identity.passwordHash)) {
      return { ok: false, message: "Invalid credentials" };
    }

    const redirectTo = await this.getPostLoginRedirectTo(found.user);
    const session = await this.createSession(found.user.id);
    return { ok: true, session, user: found.user, redirectTo };
  }

  async verifyPasswordReset(email: string, code: string, password: string) {
    const db = getDb();
    const normalized = normalizeEmail(email);
    const now = new Date();

    if (!password || password.length < 8) {
      return { ok: false, message: "Password must be at least 8 characters" };
    }

    const [challenge] = await db
      .select()
      .from(authOtpChallenges)
      .where(
        and(
          eq(authOtpChallenges.email, normalized),
          eq(authOtpChallenges.purpose, OTP_PURPOSE_PASSWORD_RESET),
          isNull(authOtpChallenges.consumedAt),
        ),
      )
      .orderBy(desc(authOtpChallenges.createdAt))
      .limit(1);

    if (!challenge || challenge.expiresAt < now || challenge.attempts >= challenge.maxAttempts) {
      return { ok: false, message: "Code expired" };
    }

    if (challenge.codeHash !== hashValue(code.trim())) {
      await db
        .update(authOtpChallenges)
        .set({ attempts: challenge.attempts + 1, updatedAt: now })
        .where(eq(authOtpChallenges.id, challenge.id));
      return { ok: false, message: "Invalid code" };
    }

    const found = await this.findUserByEmail(normalized);
    if (!found) {
      return { ok: false, message: "Invalid code" };
    }

    await db
      .update(authIdentities)
      .set({ passwordHash: makePasswordHash(password), updatedAt: now })
      .where(eq(authIdentities.userId, found.user.id));

    await db
      .update(authOtpChallenges)
      .set({ consumedAt: now, updatedAt: now })
      .where(eq(authOtpChallenges.id, challenge.id));

    await db
      .update(authSessions)
      .set({ revokedAt: now, updatedAt: now })
      .where(eq(authSessions.userId, found.user.id));

    const redirectTo = await this.getPostLoginRedirectTo(found.user);
    const session = await this.createSession(found.user.id);
    return { ok: true, session, user: found.user, redirectTo };
  }

  async validateSession(token: string) {
    const db = getDb();
    const tokenHash = hashValue(token);
    const now = new Date();

    const [session] = await db
      .select()
      .from(authSessions)
      .where(
        and(
          eq(authSessions.tokenHash, tokenHash),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, now),
        ),
      )
      .limit(1);

    if (!session) return null;

    const [user] = await db
      .select({
        id: users.id,
        clerkId: users.clerkId,
        organizationId: users.organizationId,
        role: users.role,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!user) return null;
    return { session, user };
  }

  async signOut(token: string) {
    const db = getDb();
    await db
      .update(authSessions)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(authSessions.tokenHash, hashValue(token)));
  }

  async syncFromSession(token: string) {
    const active = await this.validateSession(token);
    if (!active) return null;
    const db = getDb();
    const [org] = await db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, active.user.organizationId))
      .limit(1);
    if (!org) return null;

    return {
      user: {
        id: active.user.id,
        organizationId: active.user.organizationId,
      },
      organization: org,
      isNew: false,
    };
  }
}
