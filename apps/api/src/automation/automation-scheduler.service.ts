import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { getDb } from "@tyvera/database";
import { appointments, customers, automationSettings, businesses } from "@tyvera/database";
import { eq, and, gte, lte, or, lt, isNull } from "drizzle-orm";
import { AutomationSendService } from "./automation-send.service";
import { FeatureFlagsService } from "../common/feature-flags.service";

@Injectable()
export class AutomationSchedulerService {
  constructor(
    private readonly automationSend: AutomationSendService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  private isSchedulerEnabled(): boolean {
    return this.featureFlags.autoFollowupsSchedulerEnabled();
  }

  @Cron("*/15 * * * *")
  async runAppointmentReminders() {
    if (!this.isSchedulerEnabled()) return;

    const db = getDb();
    const now = new Date();

    const window24Start = new Date(now.getTime() + 23.5 * 60 * 60 * 1000);
    const window24End = new Date(now.getTime() + 24.5 * 60 * 60 * 1000);
    const window72Start = new Date(now.getTime() + 71.5 * 60 * 60 * 1000);
    const window72End = new Date(now.getTime() + 72.5 * 60 * 60 * 1000);

    const appointments24h = await db
      .select({
        id: appointments.id,
        businessId: appointments.businessId,
        organizationId: businesses.organizationId,
      })
      .from(appointments)
      .innerJoin(businesses, eq(appointments.businessId, businesses.id))
      .where(
        and(
          eq(appointments.status, "scheduled"),
          gte(appointments.scheduledAt, window24Start),
          lte(appointments.scheduledAt, window24End),
          isNull(appointments.reminder24hSentAt),
        ),
      );

    for (const a of appointments24h) {
      void this.automationSend
        .sendAppointmentReminder24h(a.organizationId, a.businessId, a.id)
        .catch(() => {});
    }

    const appointments72h = await db
      .select({
        id: appointments.id,
        businessId: appointments.businessId,
        organizationId: businesses.organizationId,
      })
      .from(appointments)
      .innerJoin(businesses, eq(appointments.businessId, businesses.id))
      .where(
        and(
          eq(appointments.status, "scheduled"),
          gte(appointments.scheduledAt, window72Start),
          lte(appointments.scheduledAt, window72End),
          isNull(appointments.reminder72hSentAt),
        ),
      );

    for (const a of appointments72h) {
      void this.automationSend
        .sendAppointmentReminder72h(a.organizationId, a.businessId, a.id)
        .catch(() => {});
    }
  }

  @Cron("0 2 * * *")
  async runInactivityWinback() {
    if (!this.isSchedulerEnabled()) return;

    const db = getDb();
    const settingsRows = await db
      .select({
        businessId: automationSettings.businessId,
        organizationId: businesses.organizationId,
        inactivityDays: automationSettings.inactivityDays,
        enabled: automationSettings.inactivityWinbackEnabled,
      })
      .from(automationSettings)
      .innerJoin(businesses, eq(automationSettings.businessId, businesses.id))
      .where(eq(automationSettings.inactivityWinbackEnabled, "true"));

    for (const s of settingsRows) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (s.inactivityDays ?? 60));

      const inactiveCustomers = await db
        .select({ id: customers.id })
        .from(customers)
        .where(
          and(
            eq(customers.businessId, s.businessId),
            or(
              lt(customers.lastVisitAt, cutoff),
              isNull(customers.lastVisitAt),
            ),
            isNull(customers.inactivityWinbackSentAt),
          ),
        )
        .limit(50);

      for (const c of inactiveCustomers) {
        void this.automationSend
          .sendInactivityWinback(s.organizationId, s.businessId, c.id)
          .catch(() => {});
      }
    }
  }
}
