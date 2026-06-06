import { apiRequest } from "@/lib/api";
import type { PlatformAdminSession } from "./platform-admin.types";

export function getPlatformAdminSession() {
  return apiRequest<PlatformAdminSession>("/platform-admin/session");
}
