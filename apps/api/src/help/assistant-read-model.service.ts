import { Injectable } from "@nestjs/common";
import { AppointmentsService } from "../appointments/appointments.service";
import { AutomationSettingsService } from "../automation/automation-settings.service";
import { ClientBillingRequestService } from "../billing/client-billing-request.service";
import { BusinessesService } from "../businesses/businesses.service";
import { PlanCapacityService } from "../common/plan-capacity.service";
import { CustomersService } from "../customers/customers.service";
import { InsightsService } from "../insights/insights.service";
import { ManualFollowUpService } from "../messaging/manual-follow-ups/manual-follow-up.service";
import { OnboardingService } from "../onboarding/onboarding.service";
import { AutomationJobRunService } from "../operations/automation-job-run.service";
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

function tagList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10);
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

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addMonths(base: Date, count: number) {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + count, 1));
}

function classifyMessageFailureReason(
  failureReason: string | null | undefined,
) {
  const reason = failureReason?.trim().toLowerCase() ?? "";
  if (!reason) return null;
  if (reason.includes("opt") && reason.includes("out")) {
    return "recipient_opted_out";
  }
  if (reason.includes("invalid") || reason.includes("unknown subscriber")) {
    return "invalid_recipient";
  }
  if (reason.includes("credit") || reason.includes("balance")) {
    return "insufficient_credits";
  }
  if (reason.includes("provider") || reason.includes("timeout")) {
    return "provider_delivery_issue";
  }
  return "delivery_issue";
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
    private readonly onboarding: OnboardingService,
    private readonly billingRequests: ClientBillingRequestService,
    private readonly businesses: BusinessesService,
    private readonly jobRuns: AutomationJobRunService,
    private readonly planCapacity: PlanCapacityService,
  ) {}

  async getOnboardingStatus(input: { organizationId: string }) {
    const progress = await this.onboarding.getProgress(input.organizationId);
    return {
      currentStep: progress.currentStep,
      completedSteps: progress.completedSteps,
      completedStepsCount: progress.completedSteps.length,
      timeToFirstValueAt: progress.timeToFirstValueAt,
      route: "/onboarding",
    };
  }

  async getSubscriptionAndLimits(input: {
    organizationId: string;
    businessId?: string;
  }) {
    const [billing, sms, ai, activePlan, businessLimit, businessCount, business] =
      await Promise.all([
        this.answerSource.getBillingStatus({
          organizationId: input.organizationId,
        }),
        this.answerSource.getSmsUsage({
          organizationId: input.organizationId,
        }),
        this.answerSource.getAiUsageSummary({
          organizationId: input.organizationId,
        }),
        this.planCapacity.getActivePlan(input.organizationId),
        this.planCapacity.getBusinessLimitByOrg(input.organizationId),
        this.businesses.countByOrganization(input.organizationId),
        input.businessId ? this.businesses.findById(input.businessId) : null,
      ]);
    const billingCanonical = billing.canonical;
    const smsCanonical = sms.canonical;
    const aiCanonical = ai.canonical;

    return {
      plan: billingCanonical?.planType ?? activePlan,
      billingStatus: billingCanonical?.status ?? null,
      currentPeriodEnd: billingCanonical?.currentPeriodEnd ?? null,
      branchUsage: {
        used: businessCount,
        limit: businessLimit,
        remaining: Math.max(0, businessLimit - businessCount),
      },
      sms: {
        remaining: Number(smsCanonical?.remaining ?? 0),
        total: Number(smsCanonical?.total ?? 0),
        pausedReason: smsCanonical?.pausedReason ?? "none",
      },
      ai: {
        dailyRequestsRemaining: Number(
          aiCanonical?.dailyRequestsRemaining ?? 0,
        ),
        dailyTokensRemaining: Number(
          aiCanonical?.dailyTokensRemaining ?? 0,
        ),
        monthlyRequestsRemaining: Math.max(
          0,
          Number(aiCanonical?.requestsLimit ?? 0) -
            Number(aiCanonical?.requestsUsed ?? 0),
        ),
        monthlyTokensRemaining: Math.max(
          0,
          Number(aiCanonical?.tokensLimit ?? 0) -
            Number(aiCanonical?.tokensUsed ?? 0),
        ),
        dailyResetDateTime: aiCanonical?.dailyResetDateTime ?? null,
      },
      activeBusiness:
        business && business.organizationId === input.organizationId
          ? {
              id: business.id,
              name: business.name,
              businessType: business.businessType,
            }
          : null,
    };
  }

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

  async getAutomationRuns(input: {
    organizationId: string;
    businessId?: string;
    days: 1 | 7 | 30;
  }) {
    return this.jobRuns.listRecentRuns(
      input.organizationId,
      input.businessId,
      input.days,
    );
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

  async getCustomerTimeline(
    input: TenantBusinessInput & { customerId: string },
  ) {
    const customerId = input.customerId.trim();
    if (!customerId) {
      throw new Error("INVALID_CUSTOMER_ID");
    }
    const customer = await this.customers.findById(
      customerId,
      input.organizationId,
    );
    if (!customer || customer.businessId !== input.businessId) {
      throw new Error("ASSISTANT_TARGET_OUT_OF_SCOPE");
    }
    const [appointmentsResult, history] = await Promise.all([
      this.appointments.list(input.businessId, input.organizationId, {
        limit: 100,
        offset: 0,
      }),
      this.customers.getMessageHistory(customerId, input.organizationId, 5),
    ]);
    const recentAppointments = asAppointmentItems(appointmentsResult)
      .filter((appointment) => appointment.customerId === customerId)
      .slice(0, 10)
      .map((appointment) => ({
        id: String(appointment.id ?? ""),
        scheduledAt: toIso(appointment.scheduledAt),
        status: String(appointment.status ?? "unknown"),
        visitRecordedAt: toIso(appointment.visitRecordedAt),
      }));

    return {
      customer: {
        id: customer.id,
        displayName: customer.name,
        ...(maskMobile(customer.mobile)
          ? { maskedMobile: maskMobile(customer.mobile) }
          : {}),
        visitCount: Number(customer.visitCount ?? 0),
        ...(toIso(customer.lastVisitAt)
          ? { lastVisitAt: toIso(customer.lastVisitAt) }
          : {}),
        tags: tagList(customer.tags),
      },
      recentAppointments,
      recentMessages: history.map((message) => ({
        id: message.id,
        channel: message.channel,
        purpose: message.purpose,
        status: message.status,
        deliveryStatus: message.deliveryStatus ?? null,
        sentAt: message.sentAt ?? null,
        createdAt: message.createdAt,
      })),
    };
  }

  async getAppointmentDetails(
    input: TenantBusinessInput & { appointmentId: string },
  ) {
    const appointmentId = input.appointmentId.trim();
    if (!appointmentId) {
      throw new Error("INVALID_APPOINTMENT_ID");
    }
    const appointment = await this.appointments.findById(
      appointmentId,
      input.organizationId,
    );
    if (!appointment || appointment.businessId !== input.businessId) {
      throw new Error("ASSISTANT_TARGET_OUT_OF_SCOPE");
    }
    const customer =
      appointment.customerId &&
      typeof appointment.customerId === "string"
        ? await this.customers.findById(
            appointment.customerId,
            input.organizationId,
          )
        : null;

    return {
      id: String(appointment.id ?? ""),
      customerId: String(appointment.customerId ?? ""),
      scheduledAt: toIso(appointment.scheduledAt),
      status: String(appointment.status ?? "unknown"),
      hasNotes: Boolean(appointment.notes),
      checkedInAt: toIso(appointment.checkedInAt),
      completedAt: toIso(appointment.completedAt),
      visitRecordedAt: toIso(appointment.visitRecordedAt),
      customer: customer
        ? {
            id: customer.id,
            displayName: customer.name,
            ...(maskMobile(customer.mobile)
              ? { maskedMobile: maskMobile(customer.mobile) }
              : {}),
          }
        : null,
    };
  }

  async getBillingRequests(input: {
    organizationId: string;
    limit?: number | null;
  }) {
    const maximumRows =
      getAssistantToolPolicy("get_billing_requests").maximumRows;
    const limit = clampInteger(input.limit, 1, maximumRows, 5);
    const rows = await this.billingRequests.listForOrganization(
      input.organizationId,
    );
    const items = rows.slice(0, limit).map((row) => ({
      id: row.id,
      kind: row.kind,
      status: row.status,
      requestedPlanType: row.requestedPlanType ?? null,
      requestedSku: row.requestedSku ?? null,
      requestedQuantity: row.requestedQuantity ?? null,
      hasNote: Boolean(row.note),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
    }));
    return {
      openCount: rows.filter(
        (row) => row.status === "submitted" || row.status === "under_review",
      ).length,
      items,
    };
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

  async diagnoseReminderIssue(
    input: TenantBusinessInput & { days: 7 | 30 | 90 },
  ) {
    const [settings, delivery, runs] = await Promise.all([
      this.automationSettings.getSnapshot(
        input.businessId,
        input.organizationId,
      ),
      this.getMessageDeliveryHealth({
        organizationId: input.organizationId,
        businessId: input.businessId,
        days: input.days,
      }),
      this.jobRuns.listRecentRuns(
        input.organizationId,
        input.businessId,
        input.days >= 30 ? 30 : 7,
      ),
    ]);

    if (!settings.appointmentRemindersEnabled) {
      return {
        reason: "appointment_reminders_disabled",
        headline: "Appointment reminders are disabled in automation settings.",
        evidence: [
          "appointmentRemindersEnabled=false",
          `windowDays=${input.days}`,
        ],
        fixRoute: "/settings",
      };
    }

    const latestReminderRun = runs.items.find(
      (item) => item.jobKey === "appointment_reminders",
    );
    if (latestReminderRun?.status === "failed") {
      return {
        reason: "scheduler_run_failed",
        headline: "Recent reminder scheduler run failed.",
        evidence: [
          `latestRunStatus=${latestReminderRun.status}`,
          `failedRuns=${runs.summary.failedRuns}`,
        ],
        fixRoute: "/help",
      };
    }

    if (delivery.failed > 0 && delivery.sent === 0) {
      return {
        reason: "delivery_failures_detected",
        headline: "Recent reminder delivery attempts are failing.",
        evidence: [
          `failed=${delivery.failed}`,
          `sent=${delivery.sent}`,
          `windowDays=${delivery.days}`,
        ],
        fixRoute: "/settings",
      };
    }

    return {
      reason: "no_obvious_platform_issue",
      headline: "No clear platform-side reminder issue detected from current signals.",
      evidence: [
        `failed=${delivery.failed}`,
        `sent=${delivery.sent}`,
        `latestRunStatus=${latestReminderRun?.status ?? "unknown"}`,
      ],
      fixRoute: "/appointments",
    };
  }

  async diagnoseBookingIssue(input: TenantBusinessInput) {
    const currentMonth = monthKey(new Date());
    const nextMonth = monthKey(addMonths(new Date(), 1));
    const [currentAvailability, nextAvailability, business] =
      await Promise.all([
        this.getBookingAvailability({
          organizationId: input.organizationId,
          businessId: input.businessId,
          month: currentMonth,
        }),
        this.getBookingAvailability({
          organizationId: input.organizationId,
          businessId: input.businessId,
          month: nextMonth,
        }),
        this.businesses.findById(input.businessId),
      ]);
    const currentCount = Object.keys(currentAvailability.byDay ?? {}).length;
    const nextCount = Object.keys(nextAvailability.byDay ?? {}).length;

    if (currentCount + nextCount === 0) {
      return {
        reason: "no_upcoming_booking_slots",
        headline: "No upcoming booking availability is exposed for current checks.",
        evidence: [
          `currentMonthAvailableDates=${currentCount}`,
          `nextMonthAvailableDates=${nextCount}`,
        ],
        business: business
          ? { name: business.name, businessType: business.businessType }
          : null,
        fixRoute: "/appointments",
      };
    }

    return {
      reason: "booking_slots_available",
      headline: "Booking availability exists in current checks.",
      evidence: [
        `currentMonthAvailableDates=${currentCount}`,
        `nextMonthAvailableDates=${nextCount}`,
        "Public booking-disabled state is not verified in current source.",
      ],
      business: business
        ? { name: business.name, businessType: business.businessType }
        : null,
      fixRoute: "/appointments",
    };
  }

  explainMessageStatus(input: {
    status: string;
    deliveryStatus?: string | null;
    channel?: string | null;
    failureReason?: string | null;
  }) {
    const status = input.status.trim().toLowerCase();
    const deliveryStatus = input.deliveryStatus?.trim().toLowerCase() ?? null;
    const channel = input.channel?.trim().toLowerCase() ?? "message";
    const failureCategory = classifyMessageFailureReason(input.failureReason);

    if (!status) {
      throw new Error("INVALID_MESSAGE_STATUS");
    }
    if (status === "queued") {
      return {
        meaning: `${channel} is queued and waiting for send processing.`,
        actionable: false,
      };
    }
    if (status === "sent" && deliveryStatus === "delivered") {
      return {
        meaning: `${channel} was sent and delivered.`,
        actionable: false,
      };
    }
    if (status === "sent") {
      return {
        meaning: `${channel} left Tyvera but final delivery is still pending.`,
        actionable: false,
      };
    }
    if (status === "skipped") {
      return {
        meaning: `${channel} was skipped by a rule or guardrail before delivery.`,
        actionable: true,
        likelyCause: failureCategory ?? "delivery_guardrail",
      };
    }
    if (status === "failed") {
      return {
        meaning: `${channel} failed before confirmed delivery.`,
        actionable: true,
        likelyCause: failureCategory ?? "delivery_issue",
      };
    }
    return {
      meaning: `${channel} status is ${status}.`,
      actionable: false,
    };
  }

  async explainSmsUsage(input: { organizationId: string }) {
    const [sms, billing] = await Promise.all([
      this.answerSource.getSmsUsage({
        organizationId: input.organizationId,
      }),
      this.answerSource.getBillingStatus({
        organizationId: input.organizationId,
      }),
    ]);
    const usage = sms.canonical;
    const billingStatus = billing.canonical?.status ?? null;
    const remaining = Number(usage?.remaining ?? 0);
    const total = Number(usage?.total ?? 0);
    const pausedReason = usage?.pausedReason ?? "none";

    if (remaining <= 0) {
      return {
        reason: "sms_credits_exhausted",
        explanation: "SMS credits are exhausted for the current cycle.",
        remaining,
        total,
        pausedReason,
        route: "/settings",
      };
    }
    if (pausedReason !== "none") {
      return {
        reason: "sms_sending_paused",
        explanation: "SMS sending is paused by a system guardrail.",
        remaining,
        total,
        pausedReason,
        route: "/settings",
      };
    }
    if (billingStatus && /past_due|cancelled|expired/.test(billingStatus)) {
      return {
        reason: "billing_attention_needed",
        explanation: "SMS credits remain, but billing status may block continued sending.",
        remaining,
        total,
        pausedReason,
        route: "/settings",
      };
    }
    return {
      reason: "sms_available",
      explanation: "SMS credits are available for current usage.",
      remaining,
      total,
      pausedReason,
      route: "/settings",
    };
  }

  async getRecommendedNextActions(input: TenantBusinessInput) {
    const [briefing, onboarding, billingRequests] = await Promise.all([
      this.getOwnerDailyBriefing({
        organizationId: input.organizationId,
        businessId: input.businessId,
      }),
      this.getOnboardingStatus({
        organizationId: input.organizationId,
      }),
      this.getBillingRequests({
        organizationId: input.organizationId,
        limit: 5,
      }),
    ]);

    const items: Array<{
      label: string;
      href: string;
      kind: "primary" | "secondary";
      reason: string;
      priority: number;
    }> = [];

    if (briefing.appointments.needsReview > 0) {
      items.push({
        label: "Review appointments",
        href: "/needs-attention",
        kind: "primary",
        reason: `${briefing.appointments.needsReview} appointments need review.`,
        priority: 100,
      });
    }
    if (briefing.manualFollowUps.open > 0) {
      items.push({
        label: "Follow up with customers",
        href: "/customers",
        kind: "secondary",
        reason: `${briefing.manualFollowUps.open} manual follow-ups are open.`,
        priority: 90,
      });
    }
    if (briefing.automationWarnings.length > 0) {
      items.push({
        label: "Check automation settings",
        href: "/settings",
        kind: "secondary",
        reason: briefing.automationWarnings[0]!,
        priority: 80,
      });
    }
    if (
      onboarding.currentStep > 0 ||
      onboarding.completedStepsCount === 0
    ) {
      items.push({
        label: "Continue onboarding",
        href: "/onboarding",
        kind: "secondary",
        reason: `Onboarding step ${onboarding.currentStep} is still relevant.`,
        priority: 70,
      });
    }
    if (billingRequests.openCount > 0) {
      items.push({
        label: "Review billing requests",
        href: "/settings",
        kind: "secondary",
        reason: `${billingRequests.openCount} billing requests are still open.`,
        priority: 60,
      });
    }
    if (items.length === 0) {
      items.push({
        label: "Open dashboard",
        href: "/dashboard",
        kind: "primary",
        reason: "No urgent next action was detected.",
        priority: 10,
      });
    }

    const sorted = items
      .sort((left, right) => right.priority - left.priority)
      .slice(0, 5);

    return {
      summary: sorted[0]?.reason ?? "No urgent next action was detected.",
      items: sorted,
    };
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
