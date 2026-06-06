import { Injectable } from "@nestjs/common";
import {
  adminPermissions,
  adminRolePermissions,
  adminRoles,
  getDb,
  platformAdminRoles,
  platformAdmins,
} from "@tyvera/database";
import { and, eq } from "drizzle-orm";
import type {
  PlatformAdminPermission,
  PlatformAdminRoleCode,
} from "@tyvera/types";

export interface ActivePlatformAdmin {
  id: string;
  userId: string;
  roleCodes: PlatformAdminRoleCode[];
  permissions: Set<PlatformAdminPermission>;
}

export interface PlatformAdminSession {
  platformAdmin: {
    id: string;
    userId: string;
    status: "active";
  };
  roles: PlatformAdminRoleCode[];
  permissions: PlatformAdminPermission[];
}

@Injectable()
export class PlatformAdminService {
  async resolveActivePlatformAdmin(
    userId: string,
  ): Promise<ActivePlatformAdmin | null> {
    const db = getDb();
    const [platformAdmin] = await db
      .select({
        id: platformAdmins.id,
        userId: platformAdmins.userId,
      })
      .from(platformAdmins)
      .where(
        and(
          eq(platformAdmins.userId, userId),
          eq(platformAdmins.status, "active"),
        ),
      )
      .limit(1);

    if (!platformAdmin) return null;

    const rows = await db
      .select({
        roleCode: adminRoles.code,
        permissionCode: adminPermissions.code,
      })
      .from(platformAdminRoles)
      .innerJoin(adminRoles, eq(platformAdminRoles.adminRoleId, adminRoles.id))
      .innerJoin(
        adminRolePermissions,
        eq(adminRolePermissions.adminRoleId, adminRoles.id),
      )
      .innerJoin(
        adminPermissions,
        eq(adminRolePermissions.adminPermissionId, adminPermissions.id),
      )
      .where(eq(platformAdminRoles.platformAdminId, platformAdmin.id));

    return {
      id: platformAdmin.id,
      userId: platformAdmin.userId,
      roleCodes: Array.from(
        new Set(rows.map((row) => row.roleCode as PlatformAdminRoleCode)),
      ).sort(),
      permissions: new Set(
        rows.map((row) => row.permissionCode as PlatformAdminPermission),
      ),
    };
  }

  serializeSession(platformAdmin: ActivePlatformAdmin): PlatformAdminSession {
    return {
      platformAdmin: {
        id: platformAdmin.id,
        userId: platformAdmin.userId,
        status: "active",
      },
      roles: [...platformAdmin.roleCodes].sort(),
      permissions: [...platformAdmin.permissions].sort(),
    };
  }
}
