import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantOpenAiToolsService } from "./assistant-openai-tools.service";

const answerSource = {
  getBusinessSummary: vi.fn(),
  getSmsUsage: vi.fn(),
  getBillingStatus: vi.fn(),
  getAiUsageSummary: vi.fn(),
};

const readModel = {
  getOnboardingStatus: vi.fn(),
  getSubscriptionAndLimits: vi.fn(),
  getOwnerDailyBriefing: vi.fn(),
  getAppointmentsSummary: vi.fn(),
  getNeedsReviewSummary: vi.fn(),
  getManualFollowupSummary: vi.fn(),
  getAutomationHealthSummary: vi.fn(),
  getCustomerAudienceCount: vi.fn(),
  getDuplicateCustomerSummary: vi.fn(),
  getBusinessPerformanceComparison: vi.fn(),
  getBookingAvailability: vi.fn(),
  getMessageDeliveryHealth: vi.fn(),
  getAutomationRuns: vi.fn(),
  diagnoseReminderIssue: vi.fn(),
  diagnoseBookingIssue: vi.fn(),
  explainMessageStatus: vi.fn(),
  explainSmsUsage: vi.fn(),
  getRecommendedNextActions: vi.fn(),
  findCustomers: vi.fn(),
  getCustomerTimeline: vi.fn(),
  getAppointmentDetails: vi.fn(),
  getBillingRequests: vi.fn(),
  listAppointments: vi.fn(),
  draftWinbackMessage: vi.fn(),
  draftReminderMessage: vi.fn(),
};

function createService() {
  return new AssistantOpenAiToolsService(
    answerSource as never,
    readModel as never,
  );
}

describe("AssistantOpenAiToolsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    answerSource.getBusinessSummary.mockResolvedValue({ domain: "business_summary" });
    answerSource.getSmsUsage.mockResolvedValue({ domain: "sms_usage" });
    answerSource.getBillingStatus.mockResolvedValue({ domain: "billing_status" });
    answerSource.getAiUsageSummary.mockResolvedValue({ domain: "ai_usage" });
    readModel.findCustomers.mockResolvedValue([]);
    readModel.listAppointments.mockResolvedValue([]);
    readModel.draftWinbackMessage.mockReturnValue({
      immutable: true,
      persisted: false,
      sent: false,
      draft: "Draft",
      warning: "Draft only. Nothing was saved or sent.",
    });
  });

  it("preserves the original five and exposes approved aggregate, scoped, and draft tools", () => {
    const service = createService();

    const tools = service.getToolDefinitions();

    expect(tools.map((tool) => ("name" in tool ? tool.name : null))).toEqual([
      "get_business_summary",
      "get_sms_usage",
      "get_billing_status",
      "get_ai_usage",
      "route_guidance",
      "get_onboarding_status",
      "get_subscription_and_limits",
      "get_owner_daily_briefing",
      "get_appointments_summary",
      "get_needs_review_summary",
      "get_manual_followup_summary",
      "get_automation_health_summary",
      "get_customer_audience_count",
      "get_duplicate_customer_summary",
      "get_business_performance_comparison",
      "get_booking_availability",
      "get_message_delivery_health",
      "get_automation_runs",
      "diagnose_reminder_issue",
      "diagnose_booking_issue",
      "explain_message_status",
      "explain_sms_usage",
      "get_recommended_next_actions",
      "find_customers",
      "get_customer_timeline",
      "get_appointment_details",
      "get_billing_requests",
      "list_appointments",
      "draft_winback_message",
      "draft_reminder_message",
    ]);
    for (const tool of tools) {
      expect(tool.type).toBe("function");
      if (tool.type === "function") {
        expect(tool.strict).toBe(true);
        expect(tool.parameters).toEqual(
          expect.objectContaining({ additionalProperties: false }),
        );
        const parameters = tool.parameters as {
          properties?: Record<string, unknown>;
          required?: string[];
        };
        expect(parameters.required ?? []).toEqual(
          Object.keys(parameters.properties ?? {}),
        );
      }
    }
  });

  it("uses a strict-compatible nullable schema for optional summary dates", () => {
    const service = createService();

    const summaryTool = service.getToolDefinitions()[0];

    expect(summaryTool).toEqual(
      expect.objectContaining({
        type: "function",
        name: "get_business_summary",
        strict: true,
        parameters: expect.objectContaining({
          properties: {
            year: expect.objectContaining({ type: ["integer", "null"] }),
            month: expect.objectContaining({ type: ["integer", "null"] }),
          },
          required: ["year", "month"],
          additionalProperties: false,
        }),
      }),
    );
  });

  it("rejects unsupported tool names without executing a source", async () => {
    const service = createService();

    const result = await service.execute({
      organizationId: "org-1",
      businessId: "biz-1",
      name: "delete_customer",
      argumentsJson: "{}",
    });

    expect(result).toEqual({
      tool: "unsupported",
      status: "error",
      output: { code: "UNSUPPORTED_ASSISTANT_TOOL" },
    });
    expect(answerSource.getBusinessSummary).not.toHaveBeenCalled();
  });

  it("ignores model attempts to inject another organization ID", async () => {
    const service = createService();

    await service.execute({
      organizationId: "org-authenticated",
      name: "get_sms_usage",
      argumentsJson: '{"organizationId":"org-attacker"}',
    });

    expect(answerSource.getSmsUsage).toHaveBeenCalledWith({
      organizationId: "org-authenticated",
    });
  });

  it("returns missing_business_scope without executing summary source", async () => {
    const service = createService();

    const result = await service.execute({
      organizationId: "org-1",
      name: "get_business_summary",
      argumentsJson: "{}",
    });

    expect(result).toEqual({
      tool: "get_business_summary",
      status: "skipped",
      output: { reason: "missing_business_scope" },
    });
    expect(answerSource.getBusinessSummary).not.toHaveBeenCalled();
  });

  it("returns only fixed allowlisted route guidance", async () => {
    const service = createService();

    const result = await service.execute({
      organizationId: "org-1",
      name: "route_guidance",
      argumentsJson: '{"route":"https://attacker.example"}',
    });

    expect(result.status).toBe("ok");
    expect(result.output).toEqual({
      routes: [
        "/dashboard",
        "/customers",
        "/appointments",
        "/insights",
        "/analytics",
        "/settings",
        "/help",
        "/onboarding",
        "/needs-attention",
      ],
    });
  });

  it("calls answer sources with authenticated tenant and business scope", async () => {
    const service = createService();

    await service.execute({
      organizationId: "org-authenticated",
      businessId: "biz-authenticated",
      name: "get_business_summary",
      argumentsJson: '{"year":2026,"month":6,"businessId":"biz-attacker"}',
    });

    expect(answerSource.getBusinessSummary).toHaveBeenCalledWith({
      organizationId: "org-authenticated",
      businessId: "biz-authenticated",
      year: 2026,
      month: 6,
    });
  });

  it("ignores tenant injection and dispatches safe scoped reads through server scope", async () => {
    readModel.findCustomers.mockResolvedValue([
      {
        id: "customer-1",
        displayName: "Ana",
        maskedMobile: "••••••4567",
        visitCount: 3,
        lastVisitAt: "2026-06-01T00:00:00.000Z",
      },
    ]);
    const service = createService();

    const result = await service.execute({
      organizationId: "org-authenticated",
      businessId: "biz-authenticated",
      name: "find_customers",
      argumentsJson: JSON.stringify({
        query: "Ana",
        organizationId: "org-attacker",
        businessId: "biz-attacker",
        userId: "user-attacker",
        role: "owner",
      }),
    });

    expect(readModel.findCustomers).toHaveBeenCalledWith({
      organizationId: "org-authenticated",
      businessId: "biz-authenticated",
      query: "Ana",
    });
    expect(result.output).toEqual([
      expect.objectContaining({ maskedMobile: "••••••4567" }),
    ]);
    expect(JSON.stringify(result.output)).not.toContain("+639");
  });

  it("returns minimal appointments and immutable draft outputs", async () => {
    readModel.listAppointments.mockResolvedValue([
      {
        id: "appointment-1",
        customerId: "customer-1",
        scheduledAt: "2026-06-20T02:00:00.000Z",
        status: "scheduled",
      },
    ]);
    const service = createService();

    const appointmentsResult = await service.execute({
      organizationId: "org-1",
      businessId: "biz-1",
      name: "list_appointments",
      argumentsJson: '{"from":null,"to":null}',
    });
    const draftResult = await service.execute({
      organizationId: "org-1",
      businessId: "biz-1",
      name: "draft_winback_message",
      argumentsJson:
        '{"audienceDescription":"inactive customers","offer":null,"tone":null}',
    });

    expect(appointmentsResult.output).toEqual([
      {
        id: "appointment-1",
        customerId: "customer-1",
        scheduledAt: "2026-06-20T02:00:00.000Z",
        status: "scheduled",
      },
    ]);
    expect(JSON.stringify(appointmentsResult.output)).not.toContain("notes");
    expect(draftResult.output).toEqual(
      expect.objectContaining({
        immutable: true,
        persisted: false,
        sent: false,
        warning: "Draft only. Nothing was saved or sent.",
      }),
    );
  });

  it("dispatches organization-scoped billing request reads with authenticated tenant scope", async () => {
    readModel.getBillingRequests.mockResolvedValue({
      openCount: 0,
      items: [],
    });
    const service = createService();

    await service.execute({
      organizationId: "org-authenticated",
      businessId: "biz-authenticated",
      name: "get_billing_requests",
      argumentsJson: '{"organizationId":"org-attacker","limit":3}',
    });

    expect(readModel.getBillingRequests).toHaveBeenCalledWith({
      organizationId: "org-authenticated",
      limit: 3,
    });
  });
});
