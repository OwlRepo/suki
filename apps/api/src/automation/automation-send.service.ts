import { Injectable } from "@nestjs/common";
import { getDb } from "@suki/database";
import {
  appointments,
  customers,
  automationSettings,
  businesses,
} from "@suki/database";
import { eq, and, or, lt, isNull } from "drizzle-orm";
import type { AutomationKey } from "@suki/types";
import { MessageDispatchService } from "../messaging/message-dispatch.service";
import { AutomationSettingsService } from "./automation-settings.service";
import { AutomationMessageComposerService } from "./automation-message-composer.service";
import { FeatureFlagsService } from "../common/feature-flags.service";

const RESCHEDULE_LINK_PLACEHOLDER = "[link]";
const REBOOK_LINK_PLACEHOLDER = "[link]";

@Injectable()
export class AutomationSendService {
  constructor(
    private readonly dispatch: MessageDispatchService,
    private readonly settingsService: AutomationSettingsService,
    private readonly composer: AutomationMessageComposerService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  private isAutomationEnabled(): boolean {
    return this.featureFlags.autoMessagingEnabled();
  }

  async sendAppointmentConfirmation(
    organizationId: string,
    businessId: string,
    appointmentId: string,
  ): Promise<{ status: string; reason?: string }> {
    if (!this.isAutomationEnabled()) return { status: "skipped", reason: "feature_disabled" };

    const db = getDb();
    const [appt] = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(appointments.businessId, businessId),
        ),
      )
      .limit(1);
    if (!appt || appt.confirmationSentAt) return { status: "skipped", reason: "already_sent" };

    const [cust] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, appt.customerId))
      .limit(1);
    if (!cust) return { status: "skipped", reason: "customer_not_found" };

    const settings = await this.settingsService.getOrCreate(businessId, organizationId);
    if (!settings.appointmentRemindersEnabled) return { status: "skipped", reason: "toggle_off" };

    const channel = settings.autoSendChannel as "sms" | "email";
    const rawMessage = this.composer.compose("appointment_confirmation", {
      customerName: cust.name,
      scheduledAt: appt.scheduledAt,
      staffName: appt.staffName ?? undefined,
      rescheduleLink: RESCHEDULE_LINK_PLACEHOLDER,
      businessName: undefined,
    });

    const result = await this.dispatch.dispatch({
      organizationId,
      businessId,
      customerId: cust.id,
      appointmentId,
      automationKey: "appointment_confirmation",
      purpose: "transactional",
      channel,
      rawMessage,
    });

    if (result.status === "sent") {
      await db
        .update(appointments)
        .set({ confirmationSentAt: new Date(), updatedAt: new Date() })
        .where(eq(appointments.id, appointmentId));
    }
    return { status: result.status, reason: result.reason };
  }

  async sendAppointmentReminder24h(
    organizationId: string,
    businessId: string,
    appointmentId: string,
  ): Promise<{ status: string; reason?: string }> {
    if (!this.isAutomationEnabled()) return { status: "skipped", reason: "feature_disabled" };

    const db = getDb();
    const [appt] = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(appointments.businessId, businessId),
        ),
      )
      .limit(1);
    if (!appt || appt.reminder24hSentAt || appt.status !== "scheduled")
      return { status: "skipped", reason: "already_sent_or_not_scheduled" };

    const [cust] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, appt.customerId))
      .limit(1);
    if (!cust) return { status: "skipped", reason: "customer_not_found" };

    const settings = await this.settingsService.getOrCreate(businessId, organizationId);
    if (!settings.appointmentRemindersEnabled) return { status: "skipped", reason: "toggle_off" };

    const channel = settings.autoSendChannel as "sms" | "email";
    const rawMessage = this.composer.compose("appointment_reminder_24h", {
      scheduledAt: appt.scheduledAt,
      staffName: appt.staffName ?? undefined,
      rescheduleLink: RESCHEDULE_LINK_PLACEHOLDER,
    });

    const result = await this.dispatch.dispatch({
      organizationId,
      businessId,
      customerId: cust.id,
      appointmentId,
      automationKey: "appointment_reminder_24h",
      purpose: "transactional",
      channel,
      rawMessage,
    });

    if (result.status === "sent") {
      await db
        .update(appointments)
        .set({ reminder24hSentAt: new Date(), updatedAt: new Date() })
        .where(eq(appointments.id, appointmentId));
    }
    return { status: result.status, reason: result.reason };
  }

  async sendAppointmentReminder72h(
    organizationId: string,
    businessId: string,
    appointmentId: string,
  ): Promise<{ status: string; reason?: string }> {
    if (!this.isAutomationEnabled()) return { status: "skipped", reason: "feature_disabled" };

    const db = getDb();
    const [appt] = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(appointments.businessId, businessId),
        ),
      )
      .limit(1);
    if (!appt || appt.reminder72hSentAt || appt.status !== "scheduled")
      return { status: "skipped", reason: "already_sent_or_not_scheduled" };

    const [cust] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, appt.customerId))
      .limit(1);
    if (!cust) return { status: "skipped", reason: "customer_not_found" };

    const settings = await this.settingsService.getOrCreate(businessId, organizationId);
    if (!settings.appointmentRemindersEnabled || !settings.appointmentReminder72hEnabled)
      return { status: "skipped", reason: "toggle_off" };

    const channel = settings.autoSendChannel as "sms" | "email";
    const rawMessage = this.composer.compose("appointment_reminder_72h", {
      scheduledAt: appt.scheduledAt,
      staffName: appt.staffName ?? undefined,
      rescheduleLink: RESCHEDULE_LINK_PLACEHOLDER,
    });

    const result = await this.dispatch.dispatch({
      organizationId,
      businessId,
      customerId: cust.id,
      appointmentId,
      automationKey: "appointment_reminder_72h",
      purpose: "transactional",
      channel,
      rawMessage,
    });

    if (result.status === "sent") {
      await db
        .update(appointments)
        .set({ reminder72hSentAt: new Date(), updatedAt: new Date() })
        .where(eq(appointments.id, appointmentId));
    }
    return { status: result.status, reason: result.reason };
  }

  async sendMissedRecovery(
    organizationId: string,
    businessId: string,
    appointmentId: string,
  ): Promise<{ status: string; reason?: string }> {
    if (!this.isAutomationEnabled()) return { status: "skipped", reason: "feature_disabled" };

    const db = getDb();
    const [appt] = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(appointments.businessId, businessId),
          eq(appointments.status, "missed"),
        ),
      )
      .limit(1);
    if (!appt || appt.missedRecoverySentAt) return { status: "skipped", reason: "already_sent" };

    const [cust] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, appt.customerId))
      .limit(1);
    if (!cust) return { status: "skipped", reason: "customer_not_found" };

    const settings = await this.settingsService.getOrCreate(businessId, organizationId);
    if (!settings.missedRecoveryEnabled) return { status: "skipped", reason: "toggle_off" };

    const channel = settings.autoSendChannel as "sms" | "email";
    const rawMessage = this.composer.compose("missed_recovery", {
      rebookLink: REBOOK_LINK_PLACEHOLDER,
    });

    const result = await this.dispatch.dispatch({
      organizationId,
      businessId,
      customerId: cust.id,
      appointmentId,
      automationKey: "missed_recovery",
      purpose: "transactional",
      channel,
      rawMessage,
    });

    if (result.status === "sent") {
      await db
        .update(appointments)
        .set({ missedRecoverySentAt: new Date(), updatedAt: new Date() })
        .where(eq(appointments.id, appointmentId));
    }
    return { status: result.status, reason: result.reason };
  }

  async sendPostVisitFollowup(
    organizationId: string,
    businessId: string,
    customerId: string,
    actorUserId?: string,
  ): Promise<{ status: string; reason?: string }> {
    if (!this.isAutomationEnabled()) return { status: "skipped", reason: "feature_disabled" };

    const db = getDb();
    const [cust] = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.id, customerId),
          eq(customers.businessId, businessId),
        ),
      )
      .limit(1);
    const shouldSend =
      !cust.postVisitFollowupSentAt ||
      (cust.lastVisitAt && cust.lastVisitAt > cust.postVisitFollowupSentAt);
    if (!cust || !shouldSend) return { status: "skipped", reason: "already_sent" };

    const settings = await this.settingsService.getOrCreate(businessId, organizationId);
    if (!settings.postVisitFollowUpEnabled) return { status: "skipped", reason: "toggle_off" };

    const channel = settings.autoSendChannel as "sms" | "email";
    const rawMessage = this.composer.compose("post_visit_followup", {
      rebookLink: REBOOK_LINK_PLACEHOLDER,
    });

    const result = await this.dispatch.dispatch({
      organizationId,
      businessId,
      customerId,
      actorUserId,
      automationKey: "post_visit_followup",
      purpose: "promotional",
      channel,
      rawMessage,
    });

    if (result.status === "sent") {
      await db
        .update(customers)
        .set({ postVisitFollowupSentAt: new Date(), updatedAt: new Date() })
        .where(eq(customers.id, customerId));
    }
    return { status: result.status, reason: result.reason };
  }

  async sendLoyaltyUnlock(
    organizationId: string,
    businessId: string,
    customerId: string,
  ): Promise<{ status: string; reason?: string }> {
    if (!this.isAutomationEnabled()) return { status: "skipped", reason: "feature_disabled" };

    const db = getDb();
    const [cust] = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.id, customerId),
          eq(customers.businessId, businessId),
        ),
      )
      .limit(1);
    if (!cust || cust.loyaltyUnlockSentAt) return { status: "skipped", reason: "already_sent" };

    const settings = await this.settingsService.getOrCreate(businessId, organizationId);
    if (!settings.loyaltyUnlockEnabled) return { status: "skipped", reason: "toggle_off" };

    const channel = settings.autoSendChannel as "sms" | "email";
    const rawMessage = this.composer.compose("loyalty_unlock", {});

    const result = await this.dispatch.dispatch({
      organizationId,
      businessId,
      customerId,
      automationKey: "loyalty_unlock",
      purpose: "promotional",
      channel,
      rawMessage,
    });

    if (result.status === "sent") {
      await db
        .update(customers)
        .set({ loyaltyUnlockSentAt: new Date(), updatedAt: new Date() })
        .where(eq(customers.id, customerId));
    }
    return { status: result.status, reason: result.reason };
  }

  async sendInactivityWinback(
    organizationId: string,
    businessId: string,
    customerId: string,
  ): Promise<{ status: string; reason?: string }> {
    if (!this.isAutomationEnabled()) return { status: "skipped", reason: "feature_disabled" };

    const db = getDb();
    const [cust] = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.id, customerId),
          eq(customers.businessId, businessId),
        ),
      )
      .limit(1);
    if (!cust || cust.inactivityWinbackSentAt) return { status: "skipped", reason: "already_sent" };

    const settings = await this.settingsService.getOrCreate(businessId, organizationId);
    if (!settings.inactivityWinbackEnabled) return { status: "skipped", reason: "toggle_off" };

    const channel = settings.autoSendChannel as "sms" | "email";
    const rawMessage = this.composer.compose("inactivity_winback", {});

    const result = await this.dispatch.dispatch({
      organizationId,
      businessId,
      customerId,
      automationKey: "inactivity_winback",
      purpose: "promotional",
      channel,
      rawMessage,
    });

    if (result.status === "sent") {
      await db
        .update(customers)
        .set({ inactivityWinbackSentAt: new Date(), updatedAt: new Date() })
        .where(eq(customers.id, customerId));
    }
    return { status: result.status, reason: result.reason };
  }
}
