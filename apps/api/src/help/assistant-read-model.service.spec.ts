import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantReadModelService } from "./assistant-read-model.service";

const appointments = {
  list: vi.fn(),
  listNeedsReview: vi.fn(),
  getAvailabilityForBooking: vi.fn(),
};
const customers = {
  list: vi.fn(),
  countByFilter: vi.fn(),
  findDuplicateCandidates: vi.fn(),
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
  getAiUsageSummary: vi.fn(),
};

function createService() {
  return new AssistantReadModelService(
    appointments as never,
    customers as never,
    insights as never,
    manualFollowUps as never,
    automationSettings as never,
    answerSource as never,
  );
}

describe("AssistantReadModelService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appointments.list.mockResolvedValue([]);
    appointments.listNeedsReview.mockResolvedValue([]);
    customers.countByFilter.mockResolvedValue(0);
    customers.findDuplicateCandidates.mockResolvedValue({ candidates: [] });
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
    answerSource.getAiUsageSummary.mockResolvedValue({
      canonical: { tokensUsed: 20, tokensLimit: 100 },
    });
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
