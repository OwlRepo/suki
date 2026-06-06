import type {
  PlatformAdminPermission,
  PlatformAdminRoleCode,
} from "@tyvera/types";

export interface PlatformAdminSession {
  platformAdmin: {
    id: string;
    userId: string;
    status: "active";
  };
  roles: PlatformAdminRoleCode[];
  permissions: PlatformAdminPermission[];
}
