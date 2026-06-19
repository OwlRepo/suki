import { Injectable } from "@nestjs/common";
import { getDb } from "@tyvera/database";
import { auditLogs } from "@tyvera/database";

export type AuditAction =
  | "consent_change"
  | "billing_plan_change"
  | "billing_addon_purchase"
  | "export"
  | "delete"
  | "webhook_verification_failed"
  | "assistant_customer_update"
  | "assistant_appointment_reschedule"
  | "assistant_automation_settings_update"
  | "assistant_sms_topup_request";

@Injectable()
export class AuditLogService {
  private get auditEnabled(): boolean {
    const v = process.env.FF_security_audit_enabled;
    if (v === "false" || v === "0") return false;
    if (v === "true" || v === "1") return true;
    return process.env.NODE_ENV !== "production";
  }

  async log(params: {
    organizationId: string;
    actorUserId?: string;
    action: AuditAction;
    entity: string;
    entityId?: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.auditEnabled) return;
    try {
      const db = getDb();
      await db.insert(auditLogs).values({
        organizationId: params.organizationId,
        actorUserId: params.actorUserId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        details: params.details ?? null,
      });
    } catch {
      // Do not throw; audit logging must not break primary flows
    }
  }
}
