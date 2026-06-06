import { SetMetadata } from "@nestjs/common";
import type { PlatformAdminPermission } from "@tyvera/types";

export const PLATFORM_ADMIN_PERMISSIONS_KEY = "platform-admin-permissions";

export const RequirePlatformAdminPermissions = (
  ...permissions: PlatformAdminPermission[]
) => SetMetadata(PLATFORM_ADMIN_PERMISSIONS_KEY, permissions);
