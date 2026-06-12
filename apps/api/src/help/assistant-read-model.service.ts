import { Injectable } from "@nestjs/common";
import { AppointmentsService } from "../appointments/appointments.service";
import { AutomationSettingsService } from "../automation/automation-settings.service";
import { CustomersService } from "../customers/customers.service";
import { InsightsService } from "../insights/insights.service";
import { ManualFollowUpService } from "../messaging/manual-follow-ups/manual-follow-up.service";
import { AnswerSourceService } from "./answer-source.service";
import { getAssistantToolPolicy } from "./assistant-tool-policy";

const DRAFT_WARNING = "Draft only. Nothing was saved or sent." as const;

type TenantBusinessInput = {
  organizationId: string;
  businessId: string;
};

type AppointmentRecord = Record<string, unknown>;

function toIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function asAppointmentItems(value: unknown): AppointmentRecord[] {
  if (Array.isArray(value)) return value as AppointmentRecord[];
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { items?: unknown }).items)
  ) {
    return (value as { items: AppointmentRecord[] }).items;
  }
  return [];
}

function clampInteger(
  value: number | null | undefined,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (!Number.isInteger(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Number(value)));
}

function maskMobile(
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? `••••••${digits.slice(-4)}` : "••••";
}

function monthParts(
  year: number,
  month: number,
): { previousYear: number; previousMonth: number } {
  if (month === 1) return { previousYear: year - 1, previousMonth: 12 };
  return { previousYear: year, previousMonth: month - 1 };
}

function validateMonthHorizon(month: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("INVALID_BOOKING_MONTH");
  }
  const [year, monthNumber] = month.split("-").map(Number);
  const requestedIndex = year * 12 + (monthNumber - 1);
  const now = new Date();
  const currentIndex = now.getUTCFullYear() * 12 + now.getUTCMonth();
  if (requestedIndex < currentIndex || requestedIndex > currentIndex + 3) {
    throw new Error("BOOKING_MONTH_OUT_OF_RANGE");
  }
  return month;
}

@Injectable()
export class AssistantReadModelService {
  constructor(
    private readonly appointments: AppointmentsService,
    private readonly customers: CustomersService,
    private readonly insights: InsightsService,
    private readonly manualFollowUps: ManualFollowUpService,
    private readonly automationSettings: AutomationSettingsService,
    private readonly answerSource: AnswerSourceService,
  ) {}

  async getOwnerDailyBriefing(
    input: TenantBusinessInput & { date?: string | null },
  ) {
    const date = input.date?.trim() || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error("INVALID_BRIEFING_DATE");
    }
    const from = new Date(`${date}T00:00:00.000Z`);
    const to = new Date(`${date}T23:59:59.999Z`);

    const [appointmentsResult, needsReview, manual, settings, sms, ai] =
      await Promise.all([
        this.appointments.list(input.businessId, input.organizationId, {
          from,
          to,
          limit: 100,
          offset: 0,
        }),
        this.appointments.listNeedsReview(
          input.businessId,
          input.organizationId,
          100,
        ),
        this.manualFollowUps.getOpenSummary(input.organizationId),
        this.automationSettings.getSnapshot(
          input.businessId,
          input.organizationId,
        ),
        this.answerSource.getSmsUsage({
          organizationId: input.organizationId,
        }),
        this.answerSource.getAiUsageSummary({
          organizationId: input.organizationId,
        }),
      ]);

    const items = asAppointmentItems(appointmentsResult);
    const countStatus = (status: string) =>
      items.filter((item) => item.status === status).length;
    const smsCanonical = sms.canonical;
    const aiCanonical = ai.canonical;
    const warnings = this.automationWarnings(settings);

    return {
      date,
      appointments: {
        scheduledToday: countStatus("scheduled"),
        checkedIn: countStatus("checked_in"),
        completed: countStatus("completed"),
        needsReview: needsReview.length,
      },
      manualFollowUps: {
        open: manual.open,
        duplicateRisk: manual.duplicateRisk,
      },
      usage: {
        smsRemaining: Number(smsCanonical?.remaining ?? 0),
        aiCreditsRemaining: Math.max(
          0,
          Number(aiCanonical?.tokensLimit ?? 0) -
            Number(aiCanonical?.tokensUsed ?? 0),
        ),
      },
      automationWarnings: warnings,
      suggestedRoutes: [
        "/appointments",
        "/needs-attention",
        ...(warnings.length > 0 ? ["/settings"] : []),
      ],
    };
  }

  async getAppointmentsSummary(
    input: TenantBusinessInput & {
      from?: string | null;
      to?: string | null;
    },
  ) {
    const result = await this.appointments.list(
      input.businessId,
      input.organizationId,
      {
        from: input.from ? new Date(input.from) : undefined,
        to: input.to ? new Date(input.to) : undefined,
        limit: 100,
        offset: 0,
      },
    );
    const items = asAppointmentItems(result);
    const byStatus = items.reduce<Record<string, number>>((counts, item) => {
      const status =
        typeof item.status === "string" ? item.status : "unknown";
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    }, {});
    return { total: items.length, byStatus };
  }

  async getNeedsReviewSummary(input: TenantBusinessInput) {
    const items = await this.appointments.listNeedsReview(
      input.businessId,
      input.organizationId,
      100,
    );
    return { count: items.length, route: "/needs-attention" };
  }

  getManualFollowupSummary(input: { organizationId: string }) {
    return this.manualFollowUps.getOpenSummary(input.organizationId);
  }

  async getAutomationHealthSummary(input: TenantBusinessInput) {
    const settings = await this.automationSettings.getSnapshot(
      input.businessId,
      input.organizationId,
    );
    return {
      warnings: this.automationWarnings(settings),
      enabled: {
        appointmentReminders: settings.appointmentRemindersEnabled,
        reminder72h: settings.appointmentReminder72hEnabled,
        missedRecovery: settings.missedRecoveryEnabled,
        postVisitFollowUp: settings.postVisitFollowUpEnabled,
        inactivityWinback: settings.inactivityWinbackEnabled,
        loyaltyUnlock: settings.loyaltyUnlockEnabled,
      },
    };
  }

  async getCustomerAudienceCount(
    input: TenantBusinessInput & {
      minVisits?: number | null;
      inactiveDays?: number | null;
    },
  ) {
    const minVisits = clampInteger(input.minVisits, 0, 50, 0);
    const inactiveDays = clampInteger(input.inactiveDays, 0, 365, 0);
    const count = await this.customers.countByFilter(
      input.businessId,
      input.organizationId,
      {
        minVisits,
        maxInactiveDays: inactiveDays,
      },
    );
    return { count, minVisits, inactiveDays };
  }

  async getDuplicateCustomerSummary(input: TenantBusinessInput) {
    const result = await this.customers.findDuplicateCandidates(
      input.businessId,
      input.organizationId,
      { limit: 50 },
    );
    return {
      groups: result.candidates.length,
      possibleMatches: result.candidates.reduce(
        (sum, candidate) => sum + candidate.matches.length,
        0,
      ),
    };
  }

  async getBusinessPerformanceComparison(
    input: TenantBusinessInput & {
      year?: number | null;
      month?: number | null;
    },
  ) {
    const now = new Date();
    const year = clampInteger(
      input.year,
      2000,
      2100,
      now.getUTCFullYear(),
    );
    const month = clampInteger(
      input.month,
      1,
      12,
      now.getUTCMonth() + 1,
    );
    const previous = monthParts(year, month);
    const [currentMetrics, previousMetrics] = await Promise.all([
      this.insights.getMonthlyMetrics(
        input.businessId,
        input.organizationId,
        year,
        month,
      ),
      this.insights.getMonthlyMetrics(
        input.businessId,
        input.organizationId,
        previous.previousYear,
        previous.previousMonth,
      ),
    ]);
    const current = currentMetrics ?? {
      year,
      month,
      newCustomers: 0,
      repeatCustomers: 0,
      repeatVisits: 0,
    };
    const prior = previousMetrics ?? {
      year: previous.previousYear,
      month: previous.previousMonth,
      newCustomers: 0,
      repeatCustomers: 0,
      repeatVisits: 0,
    };
    return {
      current,
      previous: prior,
      change: {
        newCustomers: current.newCustomers - prior.newCustomers,
        repeatCustomers: current.repeatCustomers - prior.repeatCustomers,
        repeatVisits: current.repeatVisits - prior.repeatVisits,
      },
    };
  }

  getBookingAvailability(
    input: TenantBusinessInput & { month: string },
  ) {
    return this.appointments.getAvailabilityForBooking(
      input.businessId,
      input.organizationId,
      validateMonthHorizon(input.month),
    );
  }

  async getMessageDeliveryHealth(input: {
    organizationId: string;
    businessId?: string;
    days: 7 | 30 | 90;
  }) {
    const days = [7, 30, 90].includes(input.days) ? input.days : 30;
    const metrics = await this.insights.getMonitoringMetrics(
      input.organizationId,
      {
        businessId: input.businessId,
        days,
      },
    );
    const daily = metrics.automation.daily;
    return {
      days,
      total: daily.reduce((sum, row) => sum + row.total, 0),
      sent: daily.reduce((sum, row) => sum + row.sent, 0),
      failed: daily.reduce((sum, row) => sum + row.failed, 0),
      skipped: daily.reduce((sum, row) => sum + row.skipped, 0),
      statusBreakdown: metrics.automation.statusBreakdown,
      channelBreakdown: metrics.automation.channelBreakdown,
    };
  }

  async findCustomers(
    input: TenantBusinessInput & { query: string },
  ) {
    const query = input.query.trim();
    if (query.length < 1 || query.length > 120) {
      throw new Error("INVALID_CUSTOMER_QUERY");
    }
    const maximumRows =
      getAssistantToolPolicy("find_customers").maximumRows;
    const result = await this.customers.list(
      input.businessId,
      input.organizationId,
      {
        search: query,
        limit: maximumRows,
      },
    );
    return result.customers.slice(0, maximumRows).map((customer) => ({
      id: customer.id,
      displayName: customer.name,
      ...(maskMobile(customer.mobile)
        ? { maskedMobile: maskMobile(customer.mobile) }
        : {}),
      visitCount: Number(customer.visitCount ?? 0),
      ...(toIso(customer.lastVisitAt)
        ? { lastVisitAt: toIso(customer.lastVisitAt) }
        : {}),
    }));
  }

  async listAppointments(
    input: TenantBusinessInput & {
      from?: string | null;
      to?: string | null;
    },
  ) {
    const maximumRows =
      getAssistantToolPolicy("list_appointments").maximumRows;
    const result = await this.appointments.list(
      input.businessId,
      input.organizationId,
      {
        from: input.from ? new Date(input.from) : undefined,
        to: input.to ? new Date(input.to) : undefined,
        limit: maximumRows,
        offset: 0,
      },
    );
    return asAppointmentItems(result)
      .slice(0, maximumRows)
      .map((appointment) => ({
        id: String(appointment.id ?? ""),
        customerId: String(appointment.customerId ?? ""),
        scheduledAt: toIso(appointment.scheduledAt),
        status: String(appointment.status ?? "unknown"),
      }));
  }

  draftWinbackMessage(input: {
    audienceDescription?: string | null;
    offer?: string | null;
    tone?: string | null;
  }) {
    const audience =
      input.audienceDescription?.trim().slice(0, 160) ||
      "customers who have not visited recently";
    const offer = input.offer?.trim().slice(0, 120);
    const prefix =
      input.tone === "professional" ? "We would be glad to welcome you back." :
      input.tone === "concise" ? "We miss you." :
      "We miss you and would love to see you again!";
    return this.draftResult(
      `${prefix} This message is for ${audience}.${offer ? ` Offer: ${offer}.` : ""}`,
    );
  }

  draftReminderMessage(input: {
    scheduledAt?: string | null;
    businessName?: string | null;
    tone?: string | null;
  }) {
    const businessName =
      input.businessName?.trim().slice(0, 120) || "our business";
    const scheduledAt = input.scheduledAt
      ? toIso(input.scheduledAt)
      : null;
    const opening =
      input.tone === "friendly" ? "Friendly reminder:" : "Reminder:";
    return this.draftResult(
      `${opening} You have an appointment with ${businessName}${scheduledAt ? ` on ${scheduledAt}` : ""}.`,
    );
  }

  private automationWarnings(settings: {
    appointmentRemindersEnabled: boolean;
    appointmentReminder72hEnabled: boolean;
    missedRecoveryEnabled: boolean;
    postVisitFollowUpEnabled: boolean;
    inactivityWinbackEnabled: boolean;
    loyaltyUnlockEnabled: boolean;
  }): string[] {
    const warnings: string[] = [];
    if (!settings.appointmentRemindersEnabled) {
      warnings.push("Appointment reminders are disabled.");
    }
    if (!settings.missedRecoveryEnabled) {
      warnings.push("Missed-appointment recovery is disabled.");
    }
    if (!settings.postVisitFollowUpEnabled) {
      warnings.push("Post-visit follow-up is disabled.");
    }
    if (!settings.inactivityWinbackEnabled) {
      warnings.push("Inactivity win-back is disabled.");
    }
    if (!settings.loyaltyUnlockEnabled) {
      warnings.push("Loyalty unlock messaging is disabled.");
    }
    return warnings;
  }

  private draftResult(draft: string) {
    return {
      immutable: true as const,
      persisted: false as const,
      sent: false as const,
      draft,
      warning: DRAFT_WARNING,
    };
  }
}
