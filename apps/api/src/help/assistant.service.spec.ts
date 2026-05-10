import { describe, it, expect, vi, beforeEach } from "vitest";
import { AssistantService } from "./assistant.service";
import { ForbiddenException } from "@nestjs/common";

const answerSource = {
  getBusinessSummary: vi.fn(),
  getSmsUsage: vi.fn(),
  getBillingStatus: vi.fn(),
  getAiUsageSummary: vi.fn(),
};

const aiExecution = {
  hasOpenAi: vi.fn(),
  executeWithGuardrails: vi.fn(),
};
const threadMemory = {
  getThreadMemory: vi.fn(),
  saveThreadMemory: vi.fn(),
};

describe("AssistantService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    threadMemory.getThreadMemory.mockResolvedValue({ summary: "", turns: [] });
    threadMemory.saveThreadMemory.mockResolvedValue(undefined);
  });

  it("returns plain-language response with primary action chip", async () => {
    aiExecution.hasOpenAi.mockReturnValue(true);
    aiExecution.executeWithGuardrails.mockResolvedValue({
      content: JSON.stringify({
        plainAnswer: "You have 250 AI credits left.",
        nextStep: "Open Settings to view full usage.",
        details: "Used 100 out of 350 this month.",
        intentKey: "usage",
        usedTools: ["get_sms_usage", "get_billing_status", "get_ai_usage"],
        actionChips: [
          { label: "View AI usage", href: "/settings", kind: "primary" },
          { label: "Open Help Center", href: "/help", kind: "secondary" },
        ],
        confidence: 0.9,
      }),
      promptTokens: 120,
      completionTokens: 90,
      totalTokens: 210,
    });

    const service = new AssistantService(
      answerSource as never,
      aiExecution as never,
      threadMemory as never,
    );
    const response = await service.chat({
      organizationId: "org-1",
      userId: "user-1",
      message: "How many AI tokens left?",
      businessId: "biz-1",
    });

    expect(response.plainAnswer).toBeTruthy();
    expect(response.nextStep).toBeTruthy();
    expect(response.actionChips[0]?.kind).toBe("primary");
    expect(response.actionChips.length).toBeLessThanOrEqual(3);
  });

  it("falls back safely when OpenAI is unavailable", async () => {
    aiExecution.hasOpenAi.mockReturnValue(false);
    const service = new AssistantService(
      answerSource as never,
      aiExecution as never,
      threadMemory as never,
    );

    const response = await service.chat({
      organizationId: "org-1",
      userId: "user-1",
      message: "How to add customer?",
      businessId: "biz-1",
    });

    expect(response.fallback?.reason).toBe("no_source");
    expect(response.actionChips.length).toBeGreaterThan(0);
  });

  it("replaces technical jargon with AI credits phrasing", async () => {
    aiExecution.hasOpenAi.mockReturnValue(true);
    aiExecution.executeWithGuardrails.mockResolvedValue({
      content: JSON.stringify({
        plainAnswer: "You consumed tokens and quota today.",
        nextStep: "Check your token quota in settings.",
        intentKey: "usage",
        usedTools: ["get_sms_usage", "get_billing_status", "get_ai_usage"],
        actionChips: [{ label: "View AI usage", href: "/settings", kind: "primary" }],
        confidence: 0.95,
      }),
      promptTokens: 120,
      completionTokens: 90,
      totalTokens: 210,
    });

    const service = new AssistantService(
      answerSource as never,
      aiExecution as never,
      threadMemory as never,
    );
    const response = await service.chat({
      organizationId: "org-1",
      userId: "user-1",
      message: "usage",
      businessId: "biz-1",
    });

    expect(response.plainAnswer.toLowerCase()).not.toContain("tokens");
    expect(response.plainAnswer.toLowerCase()).toContain("ai credits");
  });

  it("loads and saves thread memory with rolling turns", async () => {
    aiExecution.hasOpenAi.mockReturnValue(true);
    aiExecution.executeWithGuardrails.mockResolvedValue({
      content: JSON.stringify({
        plainAnswer: "Open Customers to add a customer.",
        nextStep: "Tap Add customer now.",
        intentKey: "how_to",
        usedTools: ["route_guidance"],
        actionChips: [{ label: "Add customer now", href: "/customers", kind: "primary" }],
        confidence: 0.95,
      }),
      promptTokens: 10,
      completionTokens: 10,
      totalTokens: 20,
    });
    threadMemory.getThreadMemory.mockResolvedValue({
      summary: "User asked about onboarding.",
      turns: [{ role: "user", text: "Old 1" }, { role: "assistant", text: "Old 2" }],
    });

    const service = new AssistantService(
      answerSource as never,
      aiExecution as never,
      threadMemory as never,
    );
    await service.chat({
      organizationId: "org-1",
      userId: "user-1",
      message: "How do I add customer?",
      businessId: "biz-1",
      threadId: "thread-1",
    });

    expect(threadMemory.getThreadMemory).toHaveBeenCalledWith("org-1", "user-1", "thread-1");
    expect(threadMemory.saveThreadMemory).toHaveBeenCalled();
    const savedTurns = threadMemory.saveThreadMemory.mock.calls[0][3];
    expect(savedTurns.length).toBeLessThanOrEqual(8);
  });

  it("parses JSON wrapped in markdown code blocks", async () => {
    aiExecution.hasOpenAi.mockReturnValue(true);
    aiExecution.executeWithGuardrails.mockResolvedValue({
      content: [
        "Sure, here is the result:",
        "```json",
        JSON.stringify({
          plainAnswer: "Go to Customers to add someone.",
          nextStep: "Tap Add customer now.",
          intentKey: "how_to",
          usedTools: ["route_guidance"],
          actionChips: [{ label: "Add customer now", href: "/customers", kind: "primary" }],
          confidence: 0.9,
        }),
        "```",
      ].join("\n"),
      promptTokens: 10,
      completionTokens: 10,
      totalTokens: 20,
    });

    const service = new AssistantService(
      answerSource as never,
      aiExecution as never,
      threadMemory as never,
    );
    const response = await service.chat({
      organizationId: "org-1",
      userId: "user-1",
      message: "How to add customer?",
      businessId: "biz-1",
    });

    expect(response.fallback).toBeUndefined();
    expect(response.plainAnswer.toLowerCase()).toContain("customers");
  });

  it("repairs light malformed JSON before falling back", async () => {
    aiExecution.hasOpenAi.mockReturnValue(true);
    aiExecution.executeWithGuardrails.mockResolvedValue({
      content:
        '{"plainAnswer":"Open Settings for usage.","nextStep":"Tap View AI usage.","intentKey":"usage","usedTools":["get_sms_usage","get_billing_status","get_ai_usage"],"actionChips":[{"label":"View AI usage","href":"/settings","kind":"primary"},],"confidence":0.92,}',
      promptTokens: 10,
      completionTokens: 10,
      totalTokens: 20,
    });

    const service = new AssistantService(
      answerSource as never,
      aiExecution as never,
      threadMemory as never,
    );
    const response = await service.chat({
      organizationId: "org-1",
      userId: "user-1",
      message: "Check usage",
      businessId: "biz-1",
    });

    expect(response.fallback).toBeUndefined();
    expect(response.actionChips[0]?.href).toBe("/settings");
  });

  it("normalizes legacy chip href aliases and string confidence", async () => {
    aiExecution.hasOpenAi.mockReturnValue(true);
    aiExecution.executeWithGuardrails.mockResolvedValue({
      content: JSON.stringify({
        plainAnswer: "You can create an appointment now.",
        nextStep: "Open the Appointments page to continue.",
        details: "",
        intentKey: "how_to",
        usedTools: ["route_guidance"],
        actionChips: [
          { label: "Go to Appointments", action: "/appointments", kind: "primary" },
          { label: "Help Center", url: "/help", kind: "secondary" },
        ],
        confidence: "high",
      }),
      promptTokens: 10,
      completionTokens: 10,
      totalTokens: 20,
    });

    const service = new AssistantService(
      answerSource as never,
      aiExecution as never,
      threadMemory as never,
    );
    const response = await service.chat({
      organizationId: "org-1",
      userId: "user-1",
      message: "How do I create an appointment?",
      businessId: "biz-1",
    });

    expect(response.fallback).toBeUndefined();
    expect(response.actionChips[0]?.href).toBe("/appointments");
    expect(response.actionChips[1]?.href).toBe("/help");
    expect(response.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("emits ordered stream events with done payload", async () => {
    aiExecution.hasOpenAi.mockReturnValue(true);
    aiExecution.executeWithGuardrails.mockResolvedValue({
      content: JSON.stringify({
        plainAnswer: "Go to Insights for your monthly summary.",
        nextStep: "Tap View monthly summary.",
        intentKey: "metrics",
        usedTools: ["get_business_summary", "route_guidance"],
        actionChips: [{ label: "View monthly summary", href: "/insights", kind: "primary" }],
        confidence: 0.95,
      }),
      promptTokens: 10,
      completionTokens: 10,
      totalTokens: 20,
    });

    const service = new AssistantService(
      answerSource as never,
      aiExecution as never,
      threadMemory as never,
    );
    const events = await service.chatStream({
      organizationId: "org-1",
      userId: "user-1",
      message: "What's my sales this month?",
      businessId: "biz-1",
      threadId: "thread-1",
    });

    expect(events[0]?.type).toBe("meta");
    expect(events[1]?.type).toBe("state");
    expect(events.some((event) => event.type === "stage")).toBe(true);
    expect(events.some((event) => event.type === "delta")).toBe(true);
    expect(events.at(-1)?.type).toBe("done");
  });

  it("guides time-slot questions to appointments route", async () => {
    aiExecution.hasOpenAi.mockReturnValue(false);
    const service = new AssistantService(
      answerSource as never,
      aiExecution as never,
      threadMemory as never,
    );

    const response = await service.chat({
      organizationId: "org-1",
      userId: "user-1",
      message: "Where do I create my time slots?",
      businessId: "biz-1",
    });

    expect(response.actionChips[0]?.href).toBe("/appointments");
  });

  it("executes usage intent toolset and passes outputs to model context", async () => {
    aiExecution.hasOpenAi.mockReturnValue(true);
    answerSource.getSmsUsage.mockResolvedValue({ canonicalValue: { remaining: 90 } });
    answerSource.getBillingStatus.mockResolvedValue({ canonicalValue: { plan: "Starter" } });
    answerSource.getAiUsageSummary.mockResolvedValue({ canonicalValue: { remainingMessages: 88 } });
    aiExecution.executeWithGuardrails.mockResolvedValue({
      content: JSON.stringify({
        plainAnswer: "You still have AI credits left.",
        nextStep: "Open View AI usage to check details.",
        intentKey: "usage",
        usedTools: ["get_sms_usage", "get_billing_status", "get_ai_usage"],
        actionChips: [{ label: "View AI usage", href: "/settings", kind: "primary" }],
        confidence: 0.95,
      }),
      promptTokens: 10,
      completionTokens: 10,
      totalTokens: 20,
    });

    const service = new AssistantService(
      answerSource as never,
      aiExecution as never,
      threadMemory as never,
    );
    await service.chat({
      organizationId: "org-1",
      userId: "user-1",
      message: "How many AI credits do I have left?",
      businessId: "biz-1",
    });

    expect(answerSource.getSmsUsage).toHaveBeenCalledWith({ organizationId: "org-1" });
    expect(answerSource.getBillingStatus).toHaveBeenCalledWith({ organizationId: "org-1" });
    expect(answerSource.getAiUsageSummary).toHaveBeenCalledWith({ organizationId: "org-1" });
    expect(aiExecution.executeWithGuardrails).toHaveBeenCalled();
  });

  it("falls back when model requests unsupported tools", async () => {
    aiExecution.hasOpenAi.mockReturnValue(true);
    aiExecution.executeWithGuardrails.mockResolvedValue({
      content: JSON.stringify({
        plainAnswer: "Here is your answer.",
        nextStep: "Do this next.",
        intentKey: "how_to",
        usedTools: ["delete_everything"],
        actionChips: [{ label: "Open Help Center", href: "/help", kind: "primary" }],
        confidence: 0.97,
      }),
      promptTokens: 10,
      completionTokens: 10,
      totalTokens: 20,
    });

    const service = new AssistantService(
      answerSource as never,
      aiExecution as never,
      threadMemory as never,
    );
    const response = await service.chat({
      organizationId: "org-1",
      userId: "user-1",
      message: "How do I add customer?",
      businessId: "biz-1",
    });

    expect(response.fallback?.reason).toBe("low_confidence");
  });

  it("handles metrics intent with missing business scope safely", async () => {
    aiExecution.hasOpenAi.mockReturnValue(true);
    aiExecution.executeWithGuardrails.mockResolvedValue({
      content: JSON.stringify({
        plainAnswer: "I need a selected business to check this month.",
        nextStep: "Open monthly summary and choose your business first.",
        intentKey: "metrics",
        usedTools: ["get_business_summary", "route_guidance"],
        actionChips: [{ label: "View monthly summary", href: "/insights", kind: "primary" }],
        confidence: 0.9,
      }),
      promptTokens: 10,
      completionTokens: 10,
      totalTokens: 20,
    });
    const service = new AssistantService(
      answerSource as never,
      aiExecution as never,
      threadMemory as never,
    );

    const response = await service.chat({
      organizationId: "org-1",
      userId: "user-1",
      message: "What's my sales this month?",
    });

    expect(answerSource.getBusinessSummary).not.toHaveBeenCalled();
    expect(response.actionChips[0]?.href).toBe("/insights");
  });

  it("returns capped fallback when ai policy blocks daily cap", async () => {
    aiExecution.hasOpenAi.mockReturnValue(true);
    aiExecution.executeWithGuardrails.mockRejectedValue(new ForbiddenException("AI_DAILY_CAP_EXCEEDED"));
    const service = new AssistantService(
      answerSource as never,
      aiExecution as never,
      threadMemory as never,
    );

    const response = await service.chat({
      organizationId: "org-1",
      userId: "user-1",
      message: "How do I add a customer?",
      businessId: "biz-1",
    });

    expect(response.fallback?.reason).toBe("capped");
    expect(response.plainAnswer.toLowerCase()).toContain("today");
  });

  it("sanitizes invalid chip routes instead of failing stream response", async () => {
    aiExecution.hasOpenAi.mockReturnValue(true);
    aiExecution.executeWithGuardrails.mockResolvedValue({
      content: JSON.stringify({
        plainAnswer: "Okay",
        nextStep: "Continue",
        intentKey: "how_to",
        usedTools: ["route_guidance"],
        actionChips: [{ label: "Bad", href: "/not-whitelisted", kind: "primary" }],
        confidence: 0.99,
      }),
      promptTokens: 10,
      completionTokens: 10,
      totalTokens: 20,
    });

    const service = new AssistantService(
      answerSource as never,
      aiExecution as never,
      threadMemory as never,
    );

    const events = await service.chatStream({
      organizationId: "org-1",
      userId: "user-1",
      message: "How do I add a customer?",
      businessId: "biz-1",
      threadId: "thread-1",
    });

    const done = events.find((event) => event.type === "done");
    expect(done?.type).toBe("done");
    if (done?.type === "done") {
      expect(done.response.actionChips[0]?.href).toBe("/customers");
    }
  });
});
