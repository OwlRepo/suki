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
  executeResponsesToolLoopWithGuardrails: vi.fn(),
};
const threadMemory = {
  getThreadMemory: vi.fn(),
  saveThreadMemory: vi.fn(),
};
const openAiTools = {
  getToolDefinitions: vi.fn(),
  execute: vi.fn(),
};
const mutations = {
  getToolDefinitions: vi.fn(),
  getMutationToolDefinitions: vi.fn(),
  executeTool: vi.fn(),
  confirm: vi.fn(),
};
const featureFlags = {
  assistantNativeStreamEnabled: vi.fn(),
  assistantDynamicReadToolsEnabled: vi.fn(),
  assistantMutationsEnabled: vi.fn(),
};

describe("AssistantService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("FF_openai_native_assistant_stream_enabled", "false");
    vi.stubEnv("FF_openai_native_assistant_tools_enabled", "false");
    vi.stubEnv("FF_openai_native_assistant_mutations_enabled", "false");
    threadMemory.getThreadMemory.mockResolvedValue({ summary: "", turns: [] });
    threadMemory.saveThreadMemory.mockResolvedValue(undefined);
    openAiTools.getToolDefinitions.mockReturnValue([]);
    mutations.getToolDefinitions.mockReturnValue([]);
    mutations.getMutationToolDefinitions.mockReturnValue([]);
    featureFlags.assistantNativeStreamEnabled.mockImplementation(
      () => process.env.FF_openai_native_assistant_stream_enabled === "true",
    );
    featureFlags.assistantDynamicReadToolsEnabled.mockImplementation(
      () => process.env.FF_openai_native_assistant_tools_enabled === "true",
    );
    featureFlags.assistantMutationsEnabled.mockImplementation(
      () => process.env.FF_openai_native_assistant_mutations_enabled === "true",
    );
    answerSource.getAiUsageSummary.mockResolvedValue({
      canonical: {
        tokensUsed: 1100,
        tokensLimit: 100000,
        requestsUsed: 11,
        requestsLimit: 100,
        dailyTokensUsed: 550,
        dailyTokensLimit: 20000,
        dailyRequestsUsed: 3,
        dailyRequestsLimit: 150,
        dailyResetDateTime: "2026-05-11T00:00:00.000Z",
        resetDate: "2026-06-01",
      },
    });
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
    const usageIndex = events.findIndex((event) => event.type === "usage");
    const doneIndex = events.findIndex((event) => event.type === "done");
    expect(usageIndex).toBeGreaterThan(-1);
    expect(doneIndex).toBeGreaterThan(usageIndex);
    const usageEvent = events.find((event) => event.type === "usage");
    if (usageEvent?.type === "usage") {
      expect(usageEvent.usage.dailyTokensUsed).toBe(550);
      expect(usageEvent.usage.dailyTokensLimit).toBe(20000);
    }
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

  it("preserves legacy stream behavior when native flags are disabled", async () => {
    aiExecution.hasOpenAi.mockReturnValue(false);
    const service = new AssistantService(
      answerSource as never,
      aiExecution as never,
      threadMemory as never,
      openAiTools as never,
      mutations as never,
    );
    const legacy = await service.chatStream({
      organizationId: "org-1",
      userId: "user-1",
      message: "How do I add a customer?",
      businessId: "biz-1",
    });
    const emitted: unknown[] = [];

    await service.chatStreamToEmitter(
      {
        organizationId: "org-1",
        userId: "user-1",
        message: "How do I add a customer?",
        businessId: "biz-1",
      },
      (event) => {
        emitted.push(event);
      },
    );

    expect(emitted).toEqual(legacy);
    expect(aiExecution.executeResponsesToolLoopWithGuardrails).not.toHaveBeenCalled();
  });

  it("forwards decoded native plainAnswer deltas before done", async () => {
    vi.stubEnv("FF_openai_native_assistant_stream_enabled", "true");
    aiExecution.hasOpenAi.mockReturnValue(true);
    aiExecution.executeResponsesToolLoopWithGuardrails.mockImplementation(
      async (options: { onTextDelta?: (delta: string) => Promise<void> }) => {
        await options.onTextDelta?.('{"plainAnswer":"Hello ');
        await options.onTextDelta?.(
          'world","nextStep":"Open customers.","details":null,"actionChips":[{"label":"Customers","href":"/customers","kind":"primary"}],"confidence":0.95,"intentKey":"how_to","usedTools":[]}',
        );
        return {
          content:
            '{"plainAnswer":"Hello world","nextStep":"Open customers.","details":null,"actionChips":[{"label":"Customers","href":"/customers","kind":"primary"}],"confidence":0.95,"intentKey":"how_to","usedTools":[]}',
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
          executedTools: [],
        };
      },
    );
    const service = new AssistantService(
      answerSource as never,
      aiExecution as never,
      threadMemory as never,
      openAiTools as never,
      mutations as never,
    );
    const emitted: Array<{ type: string; chunk?: string }> = [];

    await service.chatStreamToEmitter(
      {
        organizationId: "org-1",
        userId: "user-1",
        message: "How do I add a customer?",
        businessId: "biz-1",
      },
      (event) => {
        emitted.push(event);
      },
    );

    const deltaIndex = emitted.findIndex((event) => event.type === "delta");
    const doneIndex = emitted.findIndex((event) => event.type === "done");
    expect(deltaIndex).toBeGreaterThan(-1);
    expect(doneIndex).toBeGreaterThan(deltaIndex);
    expect(
      emitted.filter((event) => event.type === "delta").map((event) => event.chunk).join(""),
    ).toBe("Hello world");
  });

  it("uses server execution history instead of model-provided usedTools", async () => {
    vi.stubEnv("FF_openai_native_assistant_stream_enabled", "true");
    vi.stubEnv("FF_openai_native_assistant_tools_enabled", "true");
    aiExecution.hasOpenAi.mockReturnValue(true);
    openAiTools.getToolDefinitions.mockReturnValue([
      {
        type: "function",
        name: "get_sms_usage",
        strict: true,
        parameters: { type: "object", additionalProperties: false, properties: {} },
      },
    ]);
    openAiTools.execute.mockResolvedValue({
      tool: "get_sms_usage",
      status: "ok",
      output: { remaining: 10 },
    });
    aiExecution.executeResponsesToolLoopWithGuardrails.mockImplementation(
      async (options: {
        executeToolCall: (call: {
          name: string;
          argumentsJson: string;
          callId: string;
        }) => Promise<unknown>;
      }) => {
        await options.executeToolCall({
          name: "get_sms_usage",
          argumentsJson: "{}",
          callId: "call-1",
        });
        return {
          content:
            '{"plainAnswer":"You have SMS left.","nextStep":"Open settings.","details":null,"actionChips":[{"label":"Settings","href":"/settings","kind":"primary"}],"confidence":0.95,"intentKey":"usage","usedTools":["delete_customer"]}',
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
          executedTools: [
            { name: "get_sms_usage", callId: "call-1", round: 1 },
          ],
        };
      },
    );
    const service = new AssistantService(
      answerSource as never,
      aiExecution as never,
      threadMemory as never,
      openAiTools as never,
      mutations as never,
    );
    const emitted: Array<{ type: string }> = [];

    await service.chatStreamToEmitter(
      {
        organizationId: "org-1",
        userId: "user-1",
        message: "How many SMS credits?",
        businessId: "biz-1",
      },
      (event) => {
        emitted.push(event);
      },
    );

    expect(openAiTools.execute).toHaveBeenCalled();
    expect(emitted.some((event) => event.type === "done")).toBe(true);
    expect(emitted.some((event) => event.type === "error")).toBe(false);
  });

  it("emits an AI_DISABLED-specific terminal error", async () => {
    vi.stubEnv("FF_openai_native_assistant_stream_enabled", "true");
    aiExecution.hasOpenAi.mockReturnValue(true);
    aiExecution.executeResponsesToolLoopWithGuardrails.mockRejectedValue(
      new ForbiddenException("AI_DISABLED"),
    );
    const service = new AssistantService(
      answerSource as never,
      aiExecution as never,
      threadMemory as never,
      openAiTools as never,
      mutations as never,
    );
    const emitted: Array<{ type: string; code?: string; message?: string }> = [];

    await service.chatStreamToEmitter(
      {
        organizationId: "org-1",
        userId: "user-1",
        message: "Help",
        businessId: "biz-1",
      },
      (event) => {
        emitted.push(event);
      },
    );

    expect(emitted).toContainEqual(
      expect.objectContaining({
        type: "error",
        code: "AI_DISABLED",
        message: expect.stringMatching(/disabled/i),
      }),
    );
    expect(emitted.some((event) => event.type === "done")).toBe(false);
  });

  it("emits a safe error for malformed streamed JSON without leaking JSON syntax", async () => {
    vi.stubEnv("FF_openai_native_assistant_stream_enabled", "true");
    aiExecution.hasOpenAi.mockReturnValue(true);
    aiExecution.executeResponsesToolLoopWithGuardrails.mockImplementation(
      async (options: { onTextDelta?: (delta: string) => Promise<void> }) => {
        await options.onTextDelta?.('{"plainAnswer":"Partial');
        return {
          content: '{"plainAnswer":"Partial',
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
          executedTools: [],
        };
      },
    );
    const service = new AssistantService(
      answerSource as never,
      aiExecution as never,
      threadMemory as never,
      openAiTools as never,
      mutations as never,
    );
    const emitted: Array<{ type: string; chunk?: string; message?: string }> = [];

    await service.chatStreamToEmitter(
      {
        organizationId: "org-1",
        userId: "user-1",
        message: "Help",
        businessId: "biz-1",
      },
      (event) => {
        emitted.push(event);
      },
    );

    expect(emitted.some((event) => event.type === "error")).toBe(true);
    expect(emitted.some((event) => event.type === "done")).toBe(false);
    expect(emitted.map((event) => event.chunk ?? "").join("")).not.toMatch(/[{}]/);
    expect(threadMemory.saveThreadMemory).not.toHaveBeenCalled();
  });

  it("emits guarded mutation confirmation without applying it", async () => {
    vi.stubEnv("FF_openai_native_assistant_stream_enabled", "true");
    vi.stubEnv("FF_openai_native_assistant_tools_enabled", "true");
    vi.stubEnv("FF_openai_native_assistant_mutations_enabled", "true");
    aiExecution.hasOpenAi.mockReturnValue(true);
    mutations.getMutationToolDefinitions.mockReturnValue([
      {
        type: "function",
        name: "update_customer",
        strict: true,
        parameters: { type: "object", additionalProperties: false, properties: {} },
      },
    ]);
    mutations.executeTool.mockResolvedValue({
      tool: "update_customer",
      status: "confirmation_required",
      output: { code: "CONFIRMATION_REQUIRED" },
      confirmation: {
        token: "signed.token",
        action: "update_customer",
        summary: "Update Ana's name",
        expiresAt: "2026-06-11T16:00:00.000Z",
      },
    });
    aiExecution.executeResponsesToolLoopWithGuardrails.mockImplementation(
      async (options: {
        executeToolCall: (call: {
          name: string;
          argumentsJson: string;
          callId: string;
        }) => Promise<unknown>;
      }) => {
        await options.executeToolCall({
          name: "update_customer",
          argumentsJson: "{}",
          callId: "call-1",
        });
        return {
          content:
            '{"plainAnswer":"Please confirm the update.","nextStep":"Review the proposed change.","details":null,"actionChips":[{"label":"Customers","href":"/customers","kind":"primary"}],"confidence":0.95,"intentKey":"how_to","usedTools":[]}',
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
          executedTools: [
            { name: "update_customer", callId: "call-1", round: 1 },
          ],
        };
      },
    );
    const service = new AssistantService(
      answerSource as never,
      aiExecution as never,
      threadMemory as never,
      openAiTools as never,
      mutations as never,
      featureFlags as never,
    );
    const emitted: Array<{ type: string; confirmation?: unknown }> = [];

    await service.chatStreamToEmitter(
      {
        organizationId: "org-1",
        userId: "user-1",
        message: "Change Ana's name",
        businessId: "biz-1",
      },
      (event) => {
        emitted.push(event);
      },
    );

    expect(emitted).toContainEqual({
      type: "confirmation",
      confirmation: {
        token: "signed.token",
        action: "update_customer",
        summary: "Update Ana's name",
        expiresAt: "2026-06-11T16:00:00.000Z",
      },
    });
    expect(mutations.confirm).not.toHaveBeenCalled();
  });

  it("uses centralized flags and registers reads separately from confirmed writes", async () => {
    featureFlags.assistantNativeStreamEnabled.mockReturnValue(true);
    featureFlags.assistantDynamicReadToolsEnabled.mockReturnValue(true);
    featureFlags.assistantMutationsEnabled.mockReturnValue(true);
    aiExecution.hasOpenAi.mockReturnValue(true);
    openAiTools.getToolDefinitions.mockReturnValue([
      {
        type: "function",
        name: "find_customers",
        strict: true,
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: { query: { type: "string" } },
          required: ["query"],
        },
      },
      {
        type: "function",
        name: "draft_winback_message",
        strict: true,
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {},
          required: [],
        },
      },
    ]);
    mutations.getMutationToolDefinitions.mockReturnValue([
      {
        type: "function",
        name: "update_customer",
        strict: true,
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {},
          required: [],
        },
      },
    ]);
    aiExecution.executeResponsesToolLoopWithGuardrails.mockResolvedValue({
      content:
        '{"plainAnswer":"Done.","nextStep":"Open needs attention.","details":null,"actionChips":[{"label":"Needs attention","href":"/needs-attention","kind":"primary"}],"confidence":0.95,"intentKey":"general","usedTools":[]}',
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      executedTools: [],
    });
    const service = new AssistantService(
      answerSource as never,
      aiExecution as never,
      threadMemory as never,
      openAiTools as never,
      mutations as never,
      featureFlags as never,
    );
    const emitted: Array<{ type: string; response?: { actionChips: unknown[] } }> =
      [];

    await service.chatStreamToEmitter(
      {
        organizationId: "org-1",
        userId: "user-1",
        message: "What needs attention?",
        businessId: "biz-1",
      },
      (event) => {
        emitted.push(event as never);
      },
    );

    expect(featureFlags.assistantNativeStreamEnabled).toHaveBeenCalled();
    expect(featureFlags.assistantDynamicReadToolsEnabled).toHaveBeenCalled();
    expect(featureFlags.assistantMutationsEnabled).toHaveBeenCalled();
    expect(openAiTools.getToolDefinitions).toHaveBeenCalledWith();
    expect(mutations.getMutationToolDefinitions).toHaveBeenCalledWith();
    const toolNames = aiExecution.executeResponsesToolLoopWithGuardrails.mock
      .calls[0][0].tools.map((tool: { name?: string }) => tool.name);
    expect(toolNames).toEqual([
      "find_customers",
      "draft_winback_message",
      "update_customer",
    ]);
    expect(new Set(toolNames).size).toBe(toolNames.length);
    expect(emitted).toContainEqual(
      expect.objectContaining({
        type: "done",
        response: expect.objectContaining({
          actionChips: [
            {
              label: "Needs attention",
              href: "/needs-attention",
              kind: "primary",
            },
          ],
        }),
      }),
    );
  });

  it("preserves restricted Markdown in native plain answers and details", async () => {
    featureFlags.assistantNativeStreamEnabled.mockReturnValue(true);
    featureFlags.assistantDynamicReadToolsEnabled.mockReturnValue(false);
    featureFlags.assistantMutationsEnabled.mockReturnValue(false);
    aiExecution.hasOpenAi.mockReturnValue(true);
    const plainAnswer = [
      "## **SMS Usage**",
      "",
      "- Used: 10",
      "- Left: 90",
      "",
      "| Type | Count |",
      "| --- | ---: |",
      "| Left | 90 |",
      "",
      "This first sentence explains usage. This second sentence adds context. This third sentence must remain.",
    ].join("\n");
    const details = [
      "### Details",
      "",
      "> Values come from the current billing period.",
      "",
      "Use `AI credits` when reviewing the total.",
    ].join("\n");
    aiExecution.executeResponsesToolLoopWithGuardrails.mockResolvedValue({
      content: JSON.stringify({
        plainAnswer,
        nextStep: "Open settings.",
        details,
        actionChips: [
          { label: "Settings", href: "/settings", kind: "primary" },
        ],
        confidence: 0.95,
        intentKey: "usage",
        usedTools: [],
      }),
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      executedTools: [],
    });
    const service = new AssistantService(
      answerSource as never,
      aiExecution as never,
      threadMemory as never,
      openAiTools as never,
      mutations as never,
      featureFlags as never,
    );
    const emitted: Array<{
      type: string;
      response?: { plainAnswer: string; details?: string };
    }> = [];

    await service.chatStreamToEmitter(
      {
        organizationId: "org-1",
        userId: "user-1",
        message: "Show SMS usage",
        businessId: "biz-1",
      },
      (event) => {
        emitted.push(event as never);
      },
    );

    const done = emitted.find((event) => event.type === "done");
    expect(done?.response?.plainAnswer).toContain("## **SMS Usage**");
    expect(done?.response?.plainAnswer).toContain("| Left | 90 |");
    expect(done?.response?.plainAnswer).toContain(
      "This third sentence must remain.",
    );
    expect(done?.response?.details).toBe(details);
    const systemPrompt =
      aiExecution.executeResponsesToolLoopWithGuardrails.mock.calls[0][0]
        .input[0].content;
    expect(systemPrompt).toMatch(/restricted Markdown/i);
    expect(systemPrompt).toMatch(/Do not emit raw HTML/i);
  });

  it("strips raw HTML, replaces jargon, and caps native Markdown at 2000 characters", async () => {
    featureFlags.assistantNativeStreamEnabled.mockReturnValue(true);
    featureFlags.assistantDynamicReadToolsEnabled.mockReturnValue(false);
    featureFlags.assistantMutationsEnabled.mockReturnValue(false);
    aiExecution.hasOpenAi.mockReturnValue(true);
    const longMarkdown = `## Tokens\n\n<script>alert(1)</script>${"x".repeat(2100)}`;
    aiExecution.executeResponsesToolLoopWithGuardrails.mockResolvedValue({
      content: JSON.stringify({
        plainAnswer: longMarkdown,
        nextStep: "Check token quota.",
        details: "<b>Quota details</b>",
        actionChips: [
          { label: "Settings", href: "/settings", kind: "primary" },
        ],
        confidence: 0.95,
        intentKey: "usage",
        usedTools: [],
      }),
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      executedTools: [],
    });
    const service = new AssistantService(
      answerSource as never,
      aiExecution as never,
      threadMemory as never,
      openAiTools as never,
      mutations as never,
      featureFlags as never,
    );
    const emitted: Array<{
      type: string;
      response?: { plainAnswer: string; nextStep: string; details?: string };
    }> = [];

    await service.chatStreamToEmitter(
      {
        organizationId: "org-1",
        userId: "user-1",
        message: "Show token quota",
        businessId: "biz-1",
      },
      (event) => {
        emitted.push(event as never);
      },
    );

    const response = emitted.find((event) => event.type === "done")?.response;
    expect(response?.plainAnswer).not.toContain("<script>");
    expect(response?.plainAnswer).toContain("AI credits");
    expect(response?.plainAnswer).toHaveLength(2000);
    expect(response?.details).toBe("AI credits details");
    expect(response?.nextStep).toBe("Check AI credit AI credits.");
  });

  it("keeps legacy chat normalization limited to two concise sentences", async () => {
    aiExecution.hasOpenAi.mockReturnValue(true);
    aiExecution.executeWithGuardrails.mockResolvedValue({
      content: JSON.stringify({
        plainAnswer: "First sentence. Second sentence. Third sentence.",
        nextStep: "Open settings.",
        details: "First detail. Second detail. Third detail.",
        intentKey: "how_to",
        usedTools: ["route_guidance"],
        actionChips: [
          { label: "Settings", href: "/settings", kind: "primary" },
        ],
        confidence: 0.95,
      }),
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    });
    const service = new AssistantService(
      answerSource as never,
      aiExecution as never,
      threadMemory as never,
    );

    const response = await service.chat({
      organizationId: "org-1",
      userId: "user-1",
      message: "How do I open settings?",
      businessId: "biz-1",
    });

    expect(response.plainAnswer).toBe("First sentence. Second sentence.");
    expect(response.details).toBe("First detail. Second detail.");
  });

  it.each(["draft_winback_message", "draft_reminder_message"])(
    "derives one trusted draft-only notice from executed %s",
    async (toolName) => {
      featureFlags.assistantNativeStreamEnabled.mockReturnValue(true);
      featureFlags.assistantDynamicReadToolsEnabled.mockReturnValue(true);
      featureFlags.assistantMutationsEnabled.mockReturnValue(false);
      aiExecution.hasOpenAi.mockReturnValue(true);
      openAiTools.getToolDefinitions.mockReturnValue([
        {
          type: "function",
          name: toolName,
          strict: true,
          parameters: {
            type: "object",
            additionalProperties: false,
            properties: {},
            required: [],
          },
        },
      ]);
      aiExecution.executeResponsesToolLoopWithGuardrails.mockResolvedValue({
        content: JSON.stringify({
          plainAnswer: "Draft ready.",
          nextStep: "Review it.",
          details: null,
          actionChips: [
            {
              label: "Needs attention",
              href: "/needs-attention",
              kind: "primary",
            },
          ],
          confidence: 0.95,
          intentKey: "general",
          usedTools: [],
        }),
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
        executedTools: [{ name: toolName, callId: "call-1", round: 1 }],
      });
      const service = new AssistantService(
        answerSource as never,
        aiExecution as never,
        threadMemory as never,
        openAiTools as never,
        mutations as never,
        featureFlags as never,
      );
      const emitted: Array<{
        type: string;
        response?: { notices?: unknown[] };
      }> = [];

      await service.chatStreamToEmitter(
        {
          organizationId: "org-1",
          userId: "user-1",
          message: "Draft a message",
          businessId: "biz-1",
        },
        (event) => {
          emitted.push(event as never);
        },
      );

      expect(
        emitted.find((event) => event.type === "done")?.response?.notices,
      ).toEqual([
        {
          kind: "draft_only",
          text: "Draft only. Nothing was saved or sent.",
        },
      ]);
    },
  );

  it("omits notices without an executed draft tool and excludes them from the model schema", async () => {
    featureFlags.assistantNativeStreamEnabled.mockReturnValue(true);
    featureFlags.assistantDynamicReadToolsEnabled.mockReturnValue(false);
    featureFlags.assistantMutationsEnabled.mockReturnValue(false);
    aiExecution.hasOpenAi.mockReturnValue(true);
    aiExecution.executeResponsesToolLoopWithGuardrails.mockResolvedValue({
      content: JSON.stringify({
        plainAnswer: "Done.",
        nextStep: "Open help.",
        details: null,
        notices: [
          {
            kind: "draft_only",
            text: "Model-authored content must not be trusted.",
          },
        ],
        actionChips: [{ label: "Help", href: "/help", kind: "primary" }],
        confidence: 0.95,
        intentKey: "general",
        usedTools: [],
      }),
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      executedTools: [],
    });
    const service = new AssistantService(
      answerSource as never,
      aiExecution as never,
      threadMemory as never,
      openAiTools as never,
      mutations as never,
      featureFlags as never,
    );
    const emitted: Array<{
      type: string;
      response?: { notices?: unknown[] };
    }> = [];

    await service.chatStreamToEmitter(
      {
        organizationId: "org-1",
        userId: "user-1",
        message: "Help",
        businessId: "biz-1",
      },
      (event) => {
        emitted.push(event as never);
      },
    );

    const options =
      aiExecution.executeResponsesToolLoopWithGuardrails.mock.calls[0][0];
    expect(options.text.format.schema.properties).not.toHaveProperty("notices");
    expect(
      emitted.find((event) => event.type === "done")?.response?.notices,
    ).toBeUndefined();
  });
});
