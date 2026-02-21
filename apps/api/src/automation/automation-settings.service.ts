import { Injectable, ForbiddenException } from "@nestjs/common";
import { getDb } from "@suki/database";
import { automationSettings, businesses } from "@suki/database";
import { eq, and } from "drizzle-orm";

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
    return {
      appointment_confirmation:
        "Hi! Your appointment is confirmed for [date/time]. Reply STOP to opt out. Sent automatically by Suki",
      appointment_reminder_24h:
        "Reminder: Your appointment is tomorrow. Reschedule: [link]. Reply STOP to opt out. Sent automatically by Suki",
      appointment_reminder_72h:
        "Reminder: Your appointment is in 3 days. Reschedule: [link]. Reply STOP to opt out. Sent automatically by Suki",
      missed_recovery:
        "We noticed you missed your appointment. We'd love to see you—rebook here: [link]. Reply STOP to opt out. Sent automatically by Suki",
      post_visit_followup:
        "Thank you for visiting! We hope to see you again soon. Book your next visit: [link]. Reply STOP to opt out. Sent automatically by Suki",
      inactivity_winback:
        "We miss you! Come back and save. [Offer details]. Reply STOP to opt out. Sent automatically by Suki",
      loyalty_unlock:
        "Congratulations! You've unlocked your reward. Claim it on your next visit. Reply STOP to opt out. Sent automatically by Suki",
      channel,
    };
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
