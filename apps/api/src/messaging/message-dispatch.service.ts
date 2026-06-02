import { Injectable, Inject } from "@nestjs/common";
import { getDb } from "@tyvera/database";
import { businesses, customers, messageEvents } from "@tyvera/database";
import { eq, and, gte, sql } from "drizzle-orm";
import type { AutomationKey, MessagePurpose } from "@tyvera/types";
import { PlanCapacityService } from "../common/plan-capacity.service";
import { AutomationPolicyService } from "../automation/automation-policy.service";
import { SmsMeteringService } from "./sms-metering.service";
import { EmailMeteringService } from "./email-metering.service";
import type { ISmsProvider } from "./providers/sms.provider";
import type { IEmailProvider } from "./providers/email.provider";
import { SMS_PROVIDER, EMAIL_PROVIDER } from "./providers/provider.tokens";

const SMS_STOP = " Reply STOP to opt out.";
const AUTO_FOOTER = " Sent automatically by Tyvera";
const FOLLOWUP_DAILY_ORG_LIMIT_DEFAULT = 500;
const FOLLOWUP_DAILY_BUSINESS_LIMIT_DEFAULT = 300;
const FOLLOWUP_DAILY_USER_LIMIT_DEFAULT = 120;

function getEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function getDayStartUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
}

/** Map automation key -> required module for plan gate */
const MODULE_BY_AUTOMATION: Record<AutomationKey, string> = {
  appointment_confirmation: "auto_appointment_messaging",
  appointment_reminder_24h: "auto_appointment_messaging",
  appointment_reminder_72h: "auto_appointment_messaging",
  missed_recovery: "auto_missed_recovery",
  post_visit_followup: "auto_post_visit",
  inactivity_winback: "auto_winback",
  loyalty_unlock: "auto_loyalty_unlock",
};

export interface DispatchInput {
  organizationId: string;
  businessId: string;
  customerId: string;
  actorUserId?: string;
  appointmentId?: string;
  automationKey: AutomationKey;
  purpose: MessagePurpose;
  channel: "sms" | "email";
  rawMessage: string;
  subject?: string;
}

export interface DispatchResult {
  status: "sent" | "failed" | "skipped";
  providerMessageId?: string;
  reason?: string;
  messageEventId?: string;
}

@Injectable()
export class MessageDispatchService {
  constructor(
    private readonly planCapacity: PlanCapacityService,
    private readonly policy: AutomationPolicyService,
    private readonly smsMetering: SmsMeteringService,
    private readonly emailMetering: EmailMeteringService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: ISmsProvider,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: IEmailProvider,
  ) {}

  async dispatch(input: DispatchInput): Promise<DispatchResult> {
    const db = getDb();
    const sentBy = input.actorUserId ? `user:${input.actorUserId}` : "auto_tyvera";

    const [cust] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, input.customerId))
      .limit(1);
    if (!cust) {
        return this.recordSkipped(input, "customer_not_found");
    }

    const [biz] = await db
      .select()
      .from(businesses)
      .where(
        and(
          eq(businesses.id, input.businessId),
          eq(businesses.organizationId, input.organizationId),
        ),
      )
      .limit(1);
    if (!biz) {
      return this.recordSkipped(input, "business_not_found");
    }

    const plan = await this.planCapacity.getActivePlan(input.organizationId);
    const module = MODULE_BY_AUTOMATION[input.automationKey];
    if (!this.planCapacity.hasModuleAccess(plan, module)) {
      return this.recordSkipped(input, "plan_not_allowed");
    }

    const readOnly = await this.planCapacity.isReadOnly(input.organizationId);
    if (readOnly) {
      return this.recordSkipped(input, "billing_inactive");
    }

    const policyResult = this.policy.canSend(
      {
        mobile: cust.mobile,
        smsOptedOutAt: cust.smsOptedOutAt,
        allowTransactionalSms: cust.allowTransactionalSms,
        allowPromotionalSms: cust.allowPromotionalSms,
        emailOptedOutAt: cust.emailOptedOutAt,
        allowTransactionalEmail: cust.allowTransactionalEmail,
        allowPromotionalEmail: cust.allowPromotionalEmail,
      },
      input.purpose,
      input.channel,
    );
    if (!policyResult.allowed) {
      const reason =
        policyResult.reason === "sms_opted_out"
          ? "opted_out"
          : policyResult.reason === "missing_mobile"
            ? "missing_mobile"
            : policyResult.reason ?? "missing_consent";
      return this.recordSkipped(input, reason);
    }

    const followupCapCheck = await this.checkFollowupDailyCaps(
      input.organizationId,
      input.businessId,
      sentBy,
    );
    if (!followupCapCheck.allowed) {
      return this.recordSkipped(
        input,
        followupCapCheck.reason ?? "FOLLOWUP_DAILY_ORG_CAP_EXCEEDED",
      );
    }

    if (input.channel === "sms") {
      const canConsume = await this.smsMetering.canConsume(
        input.organizationId,
        1,
      );
      if (!canConsume.allowed) {
        return this.recordSkipped(
          input,
          canConsume.reason ?? "sms_cap_reached",
        );
      }
    } else {
      const canConsume = await this.emailMetering.canConsume(input.organizationId, 1);
      if (!canConsume.allowed) {
        return this.recordSkipped(
          input,
          canConsume.reason ?? "email_cap_reached",
        );
      }
    }

    let body = input.rawMessage.trim();
    if (input.channel === "sms") {
      if (!body.endsWith(SMS_STOP)) body += SMS_STOP;
      if (!body.endsWith(AUTO_FOOTER)) body += AUTO_FOOTER;
    } else {
      if (!body.endsWith(AUTO_FOOTER)) body += AUTO_FOOTER;
    }

    const clientRef = `tyvera-${input.automationKey}-${input.customerId}-${Date.now()}`;

    const [evt] = await db
      .insert(messageEvents)
      .values({
        businessId: input.businessId,
        customerId: input.customerId,
        appointmentId: input.appointmentId ?? null,
        automationKey: input.automationKey,
        purpose: input.purpose,
        channel: input.channel,
        content: body,
        status: "queued",
        sentBy,
        retryCount: 0,
      })
      .returning();

    const messageEventId = evt!.id;

    let result: DispatchResult;
    if (input.channel === "sms") {
      const to = cust.mobile!.trim();
      const smsResult = await this.smsProvider.send({
        to,
        body,
        clientRef,
      });

      if (smsResult.ok) {
        await db
          .update(messageEvents)
          .set({
            status: "sent",
            providerMessageId: smsResult.providerMessageId ?? null,
            sentAt: new Date(),
            deliveryStatus: "sent",
            provider: "twilio",
          })
          .where(eq(messageEvents.id, messageEventId));
        await this.smsMetering.consume(
          input.organizationId,
          input.businessId,
          messageEventId,
          1,
        );
        result = {
          status: "sent",
          providerMessageId: smsResult.providerMessageId,
          messageEventId,
        };
      } else if (smsResult.transient) {
        const retried = await this.retrySms(to, body, clientRef);
        if (retried.ok) {
          await db
            .update(messageEvents)
            .set({
              status: "sent",
              providerMessageId: retried.providerMessageId ?? null,
              sentAt: new Date(),
              retryCount: 1,
              deliveryStatus: "sent",
              provider: "twilio",
            })
            .where(eq(messageEvents.id, messageEventId));
          await this.smsMetering.consume(
            input.organizationId,
            input.businessId,
            messageEventId,
            1,
          );
          result = {
            status: "sent",
            providerMessageId: retried.providerMessageId,
            messageEventId,
          };
        } else {
          await db
            .update(messageEvents)
            .set({
              status: "failed",
              failureReason: retried.errorCode ?? "provider_error",
              retryCount: 1,
            })
            .where(eq(messageEvents.id, messageEventId));
          result = {
            status: "failed",
            reason: retried.errorCode ?? "provider_error",
            messageEventId,
          };
        }
      } else {
        await db
          .update(messageEvents)
          .set({
            status: "failed",
            failureReason: smsResult.errorCode ?? "provider_error",
          })
          .where(eq(messageEvents.id, messageEventId));
        result = {
          status: "failed",
          reason: smsResult.errorCode ?? "provider_not_configured",
          messageEventId,
        };
      }
    } else {
      const to = cust.email?.trim();
      if (!to) {
        await db
          .update(messageEvents)
          .set({
            status: "skipped",
            failureReason: "missing_email",
          })
          .where(eq(messageEvents.id, messageEventId));
        return {
          status: "skipped",
          reason: "missing_email",
          messageEventId,
        };
      }
      const emailResult = await this.emailProvider.send({
        to,
        subject: input.subject ?? "Message from Tyvera",
        body,
        clientRef,
      });
      if (emailResult.ok) {
        await db
          .update(messageEvents)
          .set({
            status: "sent",
            providerMessageId: emailResult.providerMessageId ?? null,
            sentAt: new Date(),
            deliveryStatus: "sent",
            provider: "resend",
          })
          .where(eq(messageEvents.id, messageEventId));
        result = {
          status: "sent",
          providerMessageId: emailResult.providerMessageId,
          messageEventId,
        };
        await this.emailMetering.consume(
          input.organizationId,
          input.businessId,
          messageEventId,
          1,
        );
      } else {
        await db
          .update(messageEvents)
          .set({
            status: "failed",
            failureReason: emailResult.errorCode ?? "provider_error",
          })
          .where(eq(messageEvents.id, messageEventId));
        result = {
          status: "failed",
          reason: emailResult.errorCode ?? "provider_not_configured",
          messageEventId,
        };
      }
    }

    return result;
  }

  private async retrySms(
    to: string,
    body: string,
    clientRef: string,
  ): Promise<{ ok: boolean; providerMessageId?: string; errorCode?: string }> {
    await new Promise((r) => setTimeout(r, 500));
    const res = await this.smsProvider.send({ to, body, clientRef });
    return res;
  }

  private async recordSkipped(
    input: DispatchInput,
    reason: string,
  ): Promise<DispatchResult> {
    const db = getDb();
    const [evt] = await db
      .insert(messageEvents)
      .values({
        businessId: input.businessId,
        customerId: input.customerId,
        appointmentId: input.appointmentId ?? null,
        automationKey: input.automationKey,
        purpose: input.purpose,
        channel: input.channel,
        content: input.rawMessage,
        status: "skipped",
        sentBy: input.actorUserId ? `user:${input.actorUserId}` : "auto_tyvera",
        failureReason: reason,
      })
      .returning();
    return {
      status: "skipped",
      reason,
      messageEventId: evt?.id,
    };
  }

  private async checkFollowupDailyCaps(
    organizationId: string,
    businessId: string,
    sentBy: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const db = getDb();
    const dayStart = getDayStartUTC();

    const [orgRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messageEvents)
      .innerJoin(businesses, eq(messageEvents.businessId, businesses.id))
      .where(
        and(
          eq(businesses.organizationId, organizationId),
          eq(messageEvents.status, "sent"),
          gte(messageEvents.createdAt, dayStart),
        ),
      );
    const orgLimit = getEnvInt("FOLLOWUP_DAILY_ORG_LIMIT", FOLLOWUP_DAILY_ORG_LIMIT_DEFAULT);
    const orgCount = Number(orgRow?.count ?? 0);
    if (orgLimit > 0 && orgCount >= orgLimit) {
      return { allowed: false, reason: "FOLLOWUP_DAILY_ORG_CAP_EXCEEDED" };
    }

    const [businessRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(messageEvents)
      .where(
        and(
          eq(messageEvents.businessId, businessId),
          eq(messageEvents.status, "sent"),
          gte(messageEvents.createdAt, dayStart),
        ),
      );
    const businessLimit = getEnvInt(
      "FOLLOWUP_DAILY_BUSINESS_LIMIT",
      FOLLOWUP_DAILY_BUSINESS_LIMIT_DEFAULT,
    );
    const businessCount = Number(businessRow?.count ?? 0);
    if (businessLimit > 0 && businessCount >= businessLimit) {
      return { allowed: false, reason: "FOLLOWUP_DAILY_BUSINESS_CAP_EXCEEDED" };
    }

    if (sentBy.startsWith("user:")) {
      const [userRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(messageEvents)
        .where(
          and(
            eq(messageEvents.sentBy, sentBy),
            eq(messageEvents.status, "sent"),
            gte(messageEvents.createdAt, dayStart),
          ),
        );
      const userLimit = getEnvInt("FOLLOWUP_DAILY_USER_LIMIT", FOLLOWUP_DAILY_USER_LIMIT_DEFAULT);
      const userCount = Number(userRow?.count ?? 0);
      if (userLimit > 0 && userCount >= userLimit) {
        return { allowed: false, reason: "FOLLOWUP_DAILY_USER_CAP_EXCEEDED" };
      }
    }

    return { allowed: true };
  }
}
