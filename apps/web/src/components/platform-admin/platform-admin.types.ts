import type {
  PlatformAdminPermission,
  PlatformAdminRoleCode,
} from "@suki/types";

export interface PlatformAdminSession {
  platformAdmin: {
    id: string;
    userId: string;
    status: "active";
  };
  roles: PlatformAdminRoleCode[];
  permissions: PlatformAdminPermission[];
}
