import { Injectable, ForbiddenException } from "@nestjs/common";
import { getDb } from "@suki/database";
import { automationSettings, businesses } from "@suki/database";
import { eq, and } from "drizzle-orm";
import type { AutomationKey } from "@suki/types";

type TemplateMap = Partial<Record<AutomationKey, { sms?: string; email?: string }>>;

const DEFAULT_MESSAGE_TEMPLATES: Record<AutomationKey, { sms: string; email: string }> = {
  appointment_confirmation: {
    sms: "Hi {customerName}! Your appointment{staffName} is confirmed for {dateTime}.",
    email: "Hi {customerName}, your appointment{staffName} is confirmed for {dateTime}.",
  },
  appointment_reminder_24h: {
    sms: "Reminder: Your appointment{staffName} is tomorrow. Reschedule: {link}.",
    email: "Reminder: Your appointment{staffName} is tomorrow. Reschedule here: {link}.",
  },
  appointment_reminder_72h: {
    sms: "Reminder: Your appointment{staffName} is in 3 days. Reschedule: {link}.",
    email: "Reminder: Your appointment{staffName} is in 3 days. Reschedule here: {link}.",
  },
  missed_recovery: {
    sms: "We noticed you missed your appointment. We'd love to see you—rebook here: {link}.",
    email: "We noticed you missed your appointment. We'd love to see you again. Rebook here: {link}.",
  },
  post_visit_followup: {
    sms: "Thank you for visiting! We hope to see you again soon. Book your next visit: {link}.",
    email: "Thank you for visiting! We hope to see you again soon. Book your next visit here: {link}.",
  },
  inactivity_winback: {
    sms: "We miss you! Come back and save on your next visit.",
    email: "We miss you! Come back soon and enjoy your next visit.",
  },
  loyalty_unlock: {
    sms: "Congratulations! You've unlocked your reward. Claim it on your next visit.",
    email: "Congratulations! You've unlocked your reward. Claim it on your next visit.",
  },
};

export interface AutomationSettingsResponse {
  id: string;
  businessId: string;
  appointmentRemindersEnabled: boolean;
  appointmentReminder72hEnabled: boolean;
  missedRecoveryEnabled: boolean;
  postVisitFollowUpEnabled: boolean;
  inactivityWinbackEnabled: boolean;
  loyaltyUnlockEnabled: boolean;
  inactivityDays: number;
  autoSendChannel: "sms" | "email";
  messageTemplates: TemplateMap;
}

@Injectable()
export class AutomationSettingsService {
  async getOrCreate(
    businessId: string,
    organizationId: string,
  ): Promise<AutomationSettingsResponse> {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    const [existing] = await db
      .select()
      .from(automationSettings)
      .where(eq(automationSettings.businessId, businessId))
      .limit(1);

    if (existing) {
      return this.toResponse(existing);
    }

    const [created] = await db
      .insert(automationSettings)
      .values({
        businessId,
        appointmentRemindersEnabled: "true",
        appointmentReminder72hEnabled: "false",
        missedRecoveryEnabled: "true",
        postVisitFollowUpEnabled: "true",
        inactivityWinbackEnabled: "true",
        loyaltyUnlockEnabled: "true",
        inactivityDays: 60,
        autoSendChannel: "sms",
        messageTemplates: {},
      })
      .returning();

    return this.toResponse(created!);
  }

  async update(
    businessId: string,
    organizationId: string,
    data: {
      appointmentRemindersEnabled?: boolean;
      appointmentReminder72hEnabled?: boolean;
      missedRecoveryEnabled?: boolean;
      postVisitFollowUpEnabled?: boolean;
      inactivityWinbackEnabled?: boolean;
      loyaltyUnlockEnabled?: boolean;
      inactivityDays?: number;
      autoSendChannel?: "sms" | "email";
      messageTemplates?: TemplateMap;
    },
  ): Promise<AutomationSettingsResponse> {
    await this.assertBusinessAccess(businessId, organizationId);
    const db = getDb();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.appointmentRemindersEnabled !== undefined)
      updates.appointmentRemindersEnabled = data.appointmentRemindersEnabled ? "true" : "false";
    if (data.appointmentReminder72hEnabled !== undefined)
      updates.appointmentReminder72hEnabled = data.appointmentReminder72hEnabled ? "true" : "false";
    if (data.missedRecoveryEnabled !== undefined)
      updates.missedRecoveryEnabled = data.missedRecoveryEnabled ? "true" : "false";
    if (data.postVisitFollowUpEnabled !== undefined)
      updates.postVisitFollowUpEnabled = data.postVisitFollowUpEnabled ? "true" : "false";
    if (data.inactivityWinbackEnabled !== undefined)
      updates.inactivityWinbackEnabled = data.inactivityWinbackEnabled ? "true" : "false";
    if (data.loyaltyUnlockEnabled !== undefined)
      updates.loyaltyUnlockEnabled = data.loyaltyUnlockEnabled ? "true" : "false";
    if (data.inactivityDays !== undefined) updates.inactivityDays = data.inactivityDays;
    if (data.autoSendChannel !== undefined) updates.autoSendChannel = data.autoSendChannel;
    if (data.messageTemplates !== undefined) updates.messageTemplates = data.messageTemplates;

    const [updated] = await db
      .update(automationSettings)
      .set(updates as Record<string, string | number | Date>)
      .where(eq(automationSettings.businessId, businessId))
      .returning();

    if (!updated) {
      await this.getOrCreate(businessId, organizationId);
      return this.update(businessId, organizationId, data);
    }
    return this.toResponse(updated);
  }

  async getPreviews(businessId: string, organizationId: string) {
    await this.assertBusinessAccess(businessId, organizationId);
    const settings = await this.getOrCreate(businessId, organizationId);
    const channel = settings.autoSendChannel ?? "sms";
    const templates = this.mergeTemplateDefaults(settings.messageTemplates);
    const pick = (key: AutomationKey) => templates[key]?.[channel] ?? templates[key]?.sms ?? "";
    return {
      appointment_confirmation: pick("appointment_confirmation"),
      appointment_reminder_24h: pick("appointment_reminder_24h"),
      appointment_reminder_72h: pick("appointment_reminder_72h"),
      missed_recovery: pick("missed_recovery"),
      post_visit_followup: pick("post_visit_followup"),
      inactivity_winback: pick("inactivity_winback"),
      loyalty_unlock: pick("loyalty_unlock"),
      channel,
      messageTemplates: templates,
    };
  }

  getDefaultTemplateFor(
    settings: AutomationSettingsResponse,
    key: AutomationKey,
    channel: "sms" | "email",
  ): string {
    const templates = this.mergeTemplateDefaults(settings.messageTemplates);
    return templates[key]?.[channel] ?? templates[key]?.sms ?? "";
  }

  private toResponse(row: {
    id: string;
    businessId: string;
    appointmentRemindersEnabled: string;
    appointmentReminder72hEnabled: string;
    missedRecoveryEnabled: string;
    postVisitFollowUpEnabled: string;
    inactivityWinbackEnabled: string;
    loyaltyUnlockEnabled: string;
    inactivityDays: number;
    autoSendChannel: string;
    messageTemplates?: TemplateMap;
  }) {
    return {
      id: row.id,
      businessId: row.businessId,
      appointmentRemindersEnabled: row.appointmentRemindersEnabled === "true",
      appointmentReminder72hEnabled: row.appointmentReminder72hEnabled === "true",
      missedRecoveryEnabled: row.missedRecoveryEnabled === "true",
      postVisitFollowUpEnabled: row.postVisitFollowUpEnabled === "true",
      inactivityWinbackEnabled: row.inactivityWinbackEnabled === "true",
      loyaltyUnlockEnabled: row.loyaltyUnlockEnabled === "true",
      inactivityDays: row.inactivityDays,
      autoSendChannel: row.autoSendChannel as "sms" | "email",
      messageTemplates: row.messageTemplates ?? {},
    };
  }

  private mergeTemplateDefaults(templates?: TemplateMap): Record<AutomationKey, { sms?: string; email?: string }> {
    const incoming = templates ?? {};
    return {
      appointment_confirmation: {
        ...DEFAULT_MESSAGE_TEMPLATES.appointment_confirmation,
        ...(incoming.appointment_confirmation ?? {}),
      },
      appointment_reminder_24h: {
        ...DEFAULT_MESSAGE_TEMPLATES.appointment_reminder_24h,
        ...(incoming.appointment_reminder_24h ?? {}),
      },
      appointment_reminder_72h: {
        ...DEFAULT_MESSAGE_TEMPLATES.appointment_reminder_72h,
        ...(incoming.appointment_reminder_72h ?? {}),
      },
      missed_recovery: {
        ...DEFAULT_MESSAGE_TEMPLATES.missed_recovery,
        ...(incoming.missed_recovery ?? {}),
      },
      post_visit_followup: {
        ...DEFAULT_MESSAGE_TEMPLATES.post_visit_followup,
        ...(incoming.post_visit_followup ?? {}),
      },
      inactivity_winback: {
        ...DEFAULT_MESSAGE_TEMPLATES.inactivity_winback,
        ...(incoming.inactivity_winback ?? {}),
      },
      loyalty_unlock: {
        ...DEFAULT_MESSAGE_TEMPLATES.loyalty_unlock,
        ...(incoming.loyalty_unlock ?? {}),
      },
    };
  }

  private async assertBusinessAccess(businessId: string, organizationId: string) {
    const db = getDb();
    const [biz] = await db
      .select()
      .from(businesses)
      .where(
        and(
          eq(businesses.id, businessId),
          eq(businesses.organizationId, organizationId),
        ),
      )
      .limit(1);
    if (!biz) throw new ForbiddenException("Business not found");
  }
}
