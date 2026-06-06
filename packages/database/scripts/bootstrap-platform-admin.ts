import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { resolve } from "path";
import {
  adminRoles,
  authIdentities,
  platformAdminRoles,
  platformAdmins,
  users,
} from "../src/schema";

config({ path: resolve(import.meta.dir, "../../../.env"), override: false });

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/tyvera";
const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function findBootstrapUser() {
  const userId = process.env.PLATFORM_ADMIN_BOOTSTRAP_USER_ID?.trim();
  const email = process.env.PLATFORM_ADMIN_BOOTSTRAP_EMAIL?.trim();

  if (userId) {
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) {
      throw new Error(`No existing users row found for PLATFORM_ADMIN_BOOTSTRAP_USER_ID=${userId}`);
    }
    return user;
  }

  if (email) {
    const normalized = normalizeEmail(email);
    const [identity] = await db
      .select({ userId: authIdentities.userId, email: authIdentities.email })
      .from(authIdentities)
      .where(eq(authIdentities.email, normalized))
      .limit(1);

    if (!identity) {
      const [user] = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.email, normalized))
        .limit(1);
      if (user) return user;

      throw new Error(`No existing user found for PLATFORM_ADMIN_BOOTSTRAP_EMAIL=${normalized}`);
    }

    return { id: identity.userId, email: identity.email };
  }

  throw new Error(
    "Set PLATFORM_ADMIN_BOOTSTRAP_USER_ID or PLATFORM_ADMIN_BOOTSTRAP_EMAIL to promote an existing user.",
  );
}

async function main() {
  console.log("Bootstrapping existing user as platform founder...");

  const user = await findBootstrapUser();
  const [founderRole] = await db
    .select({ id: adminRoles.id })
    .from(adminRoles)
    .where(eq(adminRoles.code, "FOUNDER"))
    .limit(1);

  if (!founderRole) {
    throw new Error("FOUNDER role is missing. Run db:seed-platform-admin-rbac first.");
  }

  const [platformAdmin] = await db
    .insert(platformAdmins)
    .values({ userId: user.id, status: "active", updatedAt: new Date() })
    .onConflictDoUpdate({
      target: platformAdmins.userId,
      set: { status: "active", updatedAt: new Date() },
    })
    .returning({ id: platformAdmins.id, userId: platformAdmins.userId });

  if (!platformAdmin) {
    throw new Error("Failed to create or update platform admin row.");
  }

  await db
    .insert(platformAdminRoles)
    .values({
      platformAdminId: platformAdmin.id,
      adminRoleId: founderRole.id,
      assignedByUserId: platformAdmin.userId,
    })
    .onConflictDoNothing();

  console.log(`Platform founder bootstrap complete for user ${user.id}.`);
}

main()
  .catch((error) => {
    console.error("Platform founder bootstrap failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
