import { apiRequest } from "@/lib/api";

export type PlatformAdminAuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  organizationId?: string | null;
  details?: Record<string, unknown> | null;
  createdAt: string;
};

export function listPlatformAdminAuditLogs() {
  return apiRequest<{ auditLogs: PlatformAdminAuditLog[] }>(
    "/platform-admin/audit-logs",
  );
}
