import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantReadModelService } from "./assistant-read-model.service";

const appointments = {
  list: vi.fn(),
  listNeedsReview: vi.fn(),
  getAvailabilityForBooking: vi.fn(),
};
const customers = {
  list: vi.fn(),
  getMessageHistory: vi.fn(),
  countByFilter: vi.fn(),
  findDuplicateCandidates: vi.fn(),
  findById: vi.fn(),
};
const insights = {
  getMonthlyMetrics: vi.fn(),
  getMonitoringMetrics: vi.fn(),
};
const manualFollowUps = {
  getOpenSummary: vi.fn(),
};
const automationSettings = {
  getSnapshot: vi.fn(),
};
const answerSource = {
  getSmsUsage: vi.fn(),
  getBillingStatus: vi.fn(),
  getAiUsageSummary: vi.fn(),
};
const onboarding = {
  getProgress: vi.fn(),
};
const billingRequests = {
  listForOrganization: vi.fn(),
};
const businesses = {
  countByOrganization: vi.fn(),
  findById: vi.fn(),
};
const jobRuns = {
  listRecentRuns: vi.fn(),
};
const planCapacity = {
  getActivePlan: vi.fn(),
  getBusinessLimitByOrg: vi.fn(),
};

function createService() {
  return new AssistantReadModelService(
    appointments as never,
    customers as never,
    insights as never,
    manualFollowUps as never,
    automationSettings as never,
    answerSource as never,
    onboarding as never,
    billingRequests as never,
    businesses as never,
    jobRuns as never,
    planCapacity as never,
  );
}

describe("AssistantReadModelService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appointments.list.mockResolvedValue([]);
    appointments.listNeedsReview.mockResolvedValue([]);
    customers.countByFilter.mockResolvedValue(0);
    customers.findDuplicateCandidates.mockResolvedValue({ candidates: [] });
    customers.getMessageHistory.mockResolvedValue([]);
    customers.findById.mockResolvedValue({
      id: "customer-1",
      businessId: "business-1",
      name: "Ana",
      mobile: "+639171234567",
      tags: "vip,returning",
      visitCount: 3,
      lastVisitAt: new Date("2026-06-01T00:00:00.000Z"),
    });
    manualFollowUps.getOpenSummary.mockResolvedValue({
      open: 0,
      duplicateRisk: 0,
      byFailureReason: [],
    });
    automationSettings.getSnapshot.mockResolvedValue({
      appointmentRemindersEnabled: true,
      appointmentReminder72hEnabled: false,
      missedRecoveryEnabled: true,
      postVisitFollowUpEnabled: true,
      inactivityWinbackEnabled: true,
      loyaltyUnlockEnabled: true,
    });
    answerSource.getSmsUsage.mockResolvedValue({
      canonical: { remaining: 80 },
    });
    answerSource.getBillingStatus.mockResolvedValue({
      canonical: {
        planType: "growth",
        status: "active",
        currentPeriodEnd: "2026-06-30T00:00:00.000Z",
      },
    });
    answerSource.getAiUsageSummary.mockResolvedValue({
      canonical: {
        tokensUsed: 20,
        tokensLimit: 100,
        requestsUsed: 4,
        requestsLimit: 10,
        dailyTokensRemaining: 30,
        dailyRequestsRemaining: 6,
        dailyResetDateTime: "2026-06-20T16:00:00.000Z",
      },
    });
    onboarding.getProgress.mockResolvedValue({
      currentStep: 2,
      completedSteps: ["workspace", "business_profile"],
      timeToFirstValueAt: null,
    });
    billingRequests.listForOrganization.mockResolvedValue([]);
    businesses.countByOrganization.mockResolvedValue(1);
    businesses.findById.mockResolvedValue({
      id: "business-1",
      organizationId: "org-1",
      name: "Tyvera Spa",
      businessType: "salon",
    });
    jobRuns.listRecentRuns.mockResolvedValue({
      items: [],
      summary: { failedRuns: 0 },
    });
    planCapacity.getActivePlan.mockResolvedValue("growth");
    planCapacity.getBusinessLimitByOrg.mockResolvedValue(3);
  });

  it("returns masked, capped customer lookup results without sensitive fields", async () => {
    customers.list.mockResolvedValue({
      customers: Array.from({ length: 7 }, (_, index) => ({
        id: `customer-${index}`,
        name: `Customer ${index}`,
        mobile: `+6391712345${index}${index}`,
        email: `customer${index}@example.com`,
        notes: "private note",
        preferences: "private preference",
        tags: "vip",
        visitCount: index,
        lastVisitAt: new Date("2026-06-01T00:00:00.000Z"),
      })),
      total: 7,
    });

    const result = await createService().findCustomers({
      organizationId: "org-1",
      businessId: "business-1",
      query: "  Customer  ",
    });

    expect(customers.list).toHaveBeenCalledWith("business-1", "org-1", {
      search: "Customer",
      limit: 5,
    });
    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({
      id: "customer-0",
      displayName: "Customer 0",
      maskedMobile: "••••••4500",
      visitCount: 0,
      lastVisitAt: "2026-06-01T00:00:00.000Z",
    });
    expect(JSON.stringify(result)).not.toMatch(
      /example\.com|private note|private preference|vip|\+639/,
    );
  });

  it("returns minimal, capped appointment records without notes", async () => {
    appointments.list.mockResolvedValue({
      items: Array.from({ length: 12 }, (_, index) => ({
        id: `appointment-${index}`,
        customerId: `customer-${index}`,
        scheduledAt: new Date("2026-06-20T02:00:00.000Z"),
        status: "scheduled",
        notes: "private appointment note",
      })),
      total: 12,
    });

    const result = await createService().listAppointments({
      organizationId: "org-1",
      businessId: "business-1",
      from: null,
      to: null,
    });

    expect(result).toHaveLength(10);
    expect(result[0]).toEqual({
      id: "appointment-0",
      customerId: "customer-0",
      scheduledAt: "2026-06-20T02:00:00.000Z",
      status: "scheduled",
    });
    expect(JSON.stringify(result)).not.toContain("private appointment note");
  });

  it("builds a privacy-safe owner daily briefing from aggregate sources", async () => {
    appointments.list.mockResolvedValue([
      { status: "scheduled" },
      { status: "checked_in" },
      { status: "completed" },
    ]);
    appointments.listNeedsReview.mockResolvedValue([{ id: "needs-review-1" }]);
    manualFollowUps.getOpenSummary.mockResolvedValue({
      open: 2,
      duplicateRisk: 1,
      byFailureReason: [{ reason: "provider_rejected", count: 2 }],
    });
    automationSettings.getSnapshot.mockResolvedValue({
      appointmentRemindersEnabled: false,
      appointmentReminder72hEnabled: false,
      missedRecoveryEnabled: true,
      postVisitFollowUpEnabled: true,
      inactivityWinbackEnabled: true,
      loyaltyUnlockEnabled: true,
    });

    const result = await createService().getOwnerDailyBriefing({
      organizationId: "org-1",
      businessId: "business-1",
      date: "2026-06-12",
    });

    expect(result).toEqual({
      date: "2026-06-12",
      appointments: {
        scheduledToday: 1,
        checkedIn: 1,
        completed: 1,
        needsReview: 1,
      },
      manualFollowUps: { open: 2, duplicateRisk: 1 },
      usage: { smsRemaining: 80, aiCreditsRemaining: 80 },
      automationWarnings: ["Appointment reminders are disabled."],
      suggestedRoutes: ["/appointments", "/needs-attention", "/settings"],
    });
  });

  it("returns subscription, limit, and active business metadata without mutating source values", async () => {
    const result = await createService().getSubscriptionAndLimits({
      organizationId: "org-1",
      businessId: "business-1",
    });

    expect(result).toEqual({
      plan: "growth",
      billingStatus: "active",
      currentPeriodEnd: "2026-06-30T00:00:00.000Z",
      branchUsage: {
        used: 1,
        limit: 3,
        remaining: 2,
      },
      sms: {
        remaining: 80,
        total: 0,
        pausedReason: "none",
      },
      ai: {
        dailyRequestsRemaining: 6,
        dailyTokensRemaining: 30,
        monthlyRequestsRemaining: 6,
        monthlyTokensRemaining: 80,
        dailyResetDateTime: "2026-06-20T16:00:00.000Z",
      },
      activeBusiness: {
        id: "business-1",
        name: "Tyvera Spa",
        businessType: "salon",
      },
    });
  });

  it("returns privacy-safe customer timeline without raw contact or failure details", async () => {
    appointments.list.mockResolvedValue({
      items: [
        {
          id: "appointment-1",
          customerId: "customer-1",
          scheduledAt: new Date("2026-06-20T02:00:00.000Z"),
          status: "scheduled",
          visitRecordedAt: null,
        },
        {
          id: "appointment-2",
          customerId: "customer-2",
          scheduledAt: new Date("2026-06-19T02:00:00.000Z"),
          status: "completed",
          visitRecordedAt: null,
        },
      ],
    });
    customers.getMessageHistory.mockResolvedValue([
      {
        id: "message-1",
        channel: "sms",
        purpose: "transactional",
        status: "sent",
        deliveryStatus: "delivered",
        failureReason: "provider secret detail",
        sentAt: "2026-06-19T01:00:00.000Z",
        createdAt: "2026-06-19T00:59:00.000Z",
      },
    ]);

    const result = await createService().getCustomerTimeline({
      organizationId: "org-1",
      businessId: "business-1",
      customerId: "customer-1",
    });

    expect(result).toEqual({
      customer: {
        id: "customer-1",
        displayName: "Ana",
        maskedMobile: "••••••4567",
        visitCount: 3,
        lastVisitAt: "2026-06-01T00:00:00.000Z",
        tags: ["vip", "returning"],
      },
      recentAppointments: [
        {
          id: "appointment-1",
          scheduledAt: "2026-06-20T02:00:00.000Z",
          status: "scheduled",
          visitRecordedAt: null,
        },
      ],
      recentMessages: [
        {
          id: "message-1",
          channel: "sms",
          purpose: "transactional",
          status: "sent",
          deliveryStatus: "delivered",
          sentAt: "2026-06-19T01:00:00.000Z",
          createdAt: "2026-06-19T00:59:00.000Z",
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("provider secret detail");
    expect(JSON.stringify(result)).not.toContain("+639");
  });

  it("prioritizes recommended next actions from review, follow-up, automation, and onboarding signals", async () => {
    appointments.list.mockResolvedValue([{ status: "scheduled" }]);
    appointments.listNeedsReview.mockResolvedValue([{ id: "needs-review-1" }]);
    manualFollowUps.getOpenSummary.mockResolvedValue({
      open: 2,
      duplicateRisk: 0,
      byFailureReason: [],
    });
    automationSettings.getSnapshot.mockResolvedValue({
      appointmentRemindersEnabled: false,
      appointmentReminder72hEnabled: false,
      missedRecoveryEnabled: true,
      postVisitFollowUpEnabled: true,
      inactivityWinbackEnabled: true,
      loyaltyUnlockEnabled: true,
    });
    billingRequests.listForOrganization.mockResolvedValue([
      {
        id: "request-1",
        status: "submitted",
        createdAt: new Date("2026-06-18T00:00:00.000Z"),
        updatedAt: new Date("2026-06-18T00:00:00.000Z"),
      },
    ]);

    const result = await createService().getRecommendedNextActions({
      organizationId: "org-1",
      businessId: "business-1",
    });

    expect(result.summary).toBe("1 appointments need review.");
    expect(result.items.map((item) => item.href)).toEqual([
      "/needs-attention",
      "/customers",
      "/settings",
      "/onboarding",
      "/settings",
    ]);
  });

  it("provides bounded aggregate reads without exposing source records", async () => {
    customers.countByFilter.mockResolvedValue(12);
    customers.findDuplicateCandidates.mockResolvedValue({
      candidates: [
        {
          customer: { id: "customer-1", name: "Private" },
          matches: [{ customer: { id: "customer-2" }, confidence: 90 }],
        },
      ],
    });
    insights.getMonthlyMetrics
      .mockResolvedValueOnce({
        year: 2026,
        month: 6,
        newCustomers: 4,
        repeatCustomers: 5,
        repeatVisits: 7,
      })
      .mockResolvedValueOnce({
        year: 2026,
        month: 5,
        newCustomers: 3,
        repeatCustomers: 2,
        repeatVisits: 4,
      });
    insights.getMonitoringMetrics.mockResolvedValue({
      windowDays: 30,
      startDate: "2026-05-14",
      automation: {
        daily: [{ day: "2026-06-12", total: 5, sent: 4, failed: 1, skipped: 0 }],
        statusBreakdown: [{ key: "sent", value: 4 }],
        channelBreakdown: [{ key: "sms", value: 5 }],
        keyBreakdown: [],
      },
    });
    appointments.getAvailabilityForBooking.mockResolvedValue({
      month: "2026-07",
      availableDates: ["2026-07-01"],
    });

    const service = createService();
    await expect(
      service.getCustomerAudienceCount({
        organizationId: "org-1",
        businessId: "business-1",
        minVisits: 2,
        inactiveDays: 60,
      }),
    ).resolves.toEqual({ count: 12, minVisits: 2, inactiveDays: 60 });
    await expect(
      service.getDuplicateCustomerSummary({
        organizationId: "org-1",
        businessId: "business-1",
      }),
    ).resolves.toEqual({ groups: 1, possibleMatches: 1 });
    await expect(
      service.getBusinessPerformanceComparison({
        organizationId: "org-1",
        businessId: "business-1",
        year: 2026,
        month: 6,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        current: expect.objectContaining({ repeatVisits: 7 }),
        previous: expect.objectContaining({ repeatVisits: 4 }),
        change: {
          newCustomers: 1,
          repeatCustomers: 3,
          repeatVisits: 3,
        },
      }),
    );
    await expect(
      service.getBookingAvailability({
        organizationId: "org-1",
        businessId: "business-1",
        month: "2026-07",
      }),
    ).resolves.toEqual({
      month: "2026-07",
      availableDates: ["2026-07-01"],
    });
    await expect(
      service.getMessageDeliveryHealth({
        organizationId: "org-1",
        businessId: "business-1",
        days: 30,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        days: 30,
        total: 5,
        sent: 4,
        failed: 1,
        skipped: 0,
      }),
    );
  });

  it("returns immutable drafts that are never persisted or sent", () => {
    const service = createService();

    expect(
      service.draftWinbackMessage({
        audienceDescription: "customers inactive for 60 days",
        offer: "10% off",
        tone: "friendly",
      }),
    ).toEqual(
      expect.objectContaining({
        immutable: true,
        persisted: false,
        sent: false,
        draft: expect.any(String),
        warning: "Draft only. Nothing was saved or sent.",
      }),
    );
    expect(
      service.draftReminderMessage({
        scheduledAt: "2026-06-20T02:00:00.000Z",
        businessName: "Tyvera Studio",
        tone: "concise",
      }),
    ).toEqual(
      expect.objectContaining({
        immutable: true,
        persisted: false,
        sent: false,
        warning: "Draft only. Nothing was saved or sent.",
      }),
    );
  });
});
