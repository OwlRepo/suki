import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import { resolve } from "path";
import {
  adminPermissions,
  adminRolePermissions,
  adminRoles,
} from "../src/schema";
import type {
  PlatformAdminPermission,
  PlatformAdminRoleCode,
} from "@tyvera/types";

config({ path: resolve(import.meta.dir, "../../../.env"), override: false });

const ROLE_DEFINITIONS: Array<{
  code: PlatformAdminRoleCode;
  name: string;
  description: string;
}> = [
  {
    code: "FOUNDER",
    name: "Founder",
    description: "Full internal Tyvera platform administration access.",
  },
  {
    code: "OPERATIONS",
    name: "Operations",
    description: "Operational monitoring and customer support visibility.",
  },
  {
    code: "FINANCE",
    name: "Finance",
    description: "Manual billing, payment, and credit adjustment access.",
  },
  {
    code: "SUPPORT",
    name: "Support",
    description: "Customer and communication support visibility.",
  },
];

const PERMISSION_DEFINITIONS: Array<{
  code: PlatformAdminPermission;
  description: string;
}> = [
  { code: "PLATFORM_ADMIN_ACCESS", description: "Access the internal platform-admin console." },
  { code: "OVERVIEW_VIEW", description: "View the internal platform overview." },
  { code: "BUSINESS_VIEW", description: "View tenant organizations and business details." },
  { code: "BUSINESS_UPDATE", description: "Update tenant organization data." },
  { code: "BUSINESS_SUSPEND", description: "Suspend tenant organization access." },
  { code: "BILLING_REQUEST_VIEW", description: "View manual billing requests." },
  { code: "BILLING_REQUEST_CREATE", description: "Create manual billing requests." },
  { code: "BILLING_REQUEST_VOID", description: "Void manual billing requests." },
  { code: "PAYMENT_VIEW", description: "View manual payment records." },
  { code: "PAYMENT_RECORD", description: "Record reported manual payments." },
  { code: "PAYMENT_VERIFY", description: "Verify manual payments." },
  { code: "PAYMENT_REJECT", description: "Reject manual payments." },
  { code: "SMS_CREDIT_VIEW", description: "View tenant SMS credit balances." },
  { code: "SMS_CREDIT_GRANT_PROMOTIONAL", description: "Grant promotional SMS credits." },
  { code: "SMS_CREDIT_APPLY_CORRECTION", description: "Apply SMS credit corrections." },
  { code: "COMMUNICATION_VIEW", description: "View communication delivery health." },
  { code: "AUTOMATION_RUN_VIEW", description: "View automation run health." },
  { code: "ALERT_VIEW", description: "View platform operations alerts." },
  { code: "ALERT_ACKNOWLEDGE", description: "Acknowledge platform operations alerts." },
  { code: "AUDIT_LOG_VIEW", description: "View platform-admin audit logs." },
];

const ROLE_PERMISSIONS: Record<PlatformAdminRoleCode, PlatformAdminPermission[]> = {
  FOUNDER: PERMISSION_DEFINITIONS.map((permission) => permission.code),
  OPERATIONS: [
    "PLATFORM_ADMIN_ACCESS",
    "OVERVIEW_VIEW",
    "BUSINESS_VIEW",
    "SMS_CREDIT_VIEW",
    "COMMUNICATION_VIEW",
    "AUTOMATION_RUN_VIEW",
    "ALERT_VIEW",
    "ALERT_ACKNOWLEDGE",
    "AUDIT_LOG_VIEW",
  ],
  FINANCE: [
    "PLATFORM_ADMIN_ACCESS",
    "OVERVIEW_VIEW",
    "BUSINESS_VIEW",
    "BILLING_REQUEST_VIEW",
    "BILLING_REQUEST_CREATE",
    "BILLING_REQUEST_VOID",
    "PAYMENT_VIEW",
    "PAYMENT_RECORD",
    "PAYMENT_VERIFY",
    "PAYMENT_REJECT",
    "SMS_CREDIT_VIEW",
    "SMS_CREDIT_GRANT_PROMOTIONAL",
    "SMS_CREDIT_APPLY_CORRECTION",
    "AUDIT_LOG_VIEW",
  ],
  SUPPORT: [
    "PLATFORM_ADMIN_ACCESS",
    "OVERVIEW_VIEW",
    "BUSINESS_VIEW",
    "SMS_CREDIT_VIEW",
    "COMMUNICATION_VIEW",
  ],
};

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/tyvera";
const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

async function main() {
  console.log("Seeding platform-admin RBAC...");

  for (const permission of PERMISSION_DEFINITIONS) {
    await db
      .insert(adminPermissions)
      .values(permission)
      .onConflictDoUpdate({
        target: adminPermissions.code,
        set: { description: permission.description },
      });
  }

  for (const role of ROLE_DEFINITIONS) {
    await db
      .insert(adminRoles)
      .values({ ...role, isSystemRole: "true", updatedAt: new Date() })
      .onConflictDoUpdate({
        target: adminRoles.code,
        set: {
          name: role.name,
          description: role.description,
          isSystemRole: "true",
          updatedAt: new Date(),
        },
      });
  }

  const roleRows = await db
    .select({ id: adminRoles.id, code: adminRoles.code })
    .from(adminRoles)
    .where(inArray(adminRoles.code, ROLE_DEFINITIONS.map((role) => role.code)));
  const permissionRows = await db
    .select({ id: adminPermissions.id, code: adminPermissions.code })
    .from(adminPermissions)
    .where(
      inArray(
        adminPermissions.code,
        PERMISSION_DEFINITIONS.map((permission) => permission.code),
      ),
    );

  const roleIds = new Map(roleRows.map((role) => [role.code, role.id]));
  const permissionIds = new Map(
    permissionRows.map((permission) => [permission.code, permission.id]),
  );

  for (const [roleCode, permissions] of Object.entries(ROLE_PERMISSIONS) as Array<
    [PlatformAdminRoleCode, PlatformAdminPermission[]]
  >) {
    const adminRoleId = roleIds.get(roleCode);
    if (!adminRoleId) {
      throw new Error(`Missing seeded role: ${roleCode}`);
    }

    for (const permissionCode of permissions) {
      const adminPermissionId = permissionIds.get(permissionCode);
      if (!adminPermissionId) {
        throw new Error(`Missing seeded permission: ${permissionCode}`);
      }

      await db
        .insert(adminRolePermissions)
        .values({ adminRoleId, adminPermissionId })
        .onConflictDoNothing();
    }
  }

  const counts = await Promise.all(
    ROLE_DEFINITIONS.map(async (role) => {
      const roleId = roleIds.get(role.code);
      if (!roleId) return `${role.code}:0`;
      const permissions = await db
        .select({ id: adminRolePermissions.id })
        .from(adminRolePermissions)
        .where(eq(adminRolePermissions.adminRoleId, roleId));
      return `${role.code}:${permissions.length}`;
    }),
  );

  console.log(`Platform-admin RBAC seed complete (${counts.join(", ")}).`);
}

main()
  .catch((error) => {
    console.error("Platform-admin RBAC seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
