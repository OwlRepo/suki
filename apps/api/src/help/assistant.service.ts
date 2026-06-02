import { Injectable } from "@nestjs/common";
import { AnswerSourceService } from "./answer-source.service";
import { AiExecutionService } from "../ai/ai-execution.service";
import type {
  AssistantActionChip,
  AssistantChatResponse,
  AssistantChatStreamEvent,
} from "./assistant.types";
import { AssistantThreadMemoryService } from "./assistant-thread-memory.service";
import { buildAssistantContextPack, type AssistantIntent } from "./assistant-context";

const SAFE_ROUTE_WHITELIST = new Set([
  "/dashboard",
  "/customers",
  "/appointments",
  "/insights",
  "/analytics",
  "/settings",
  "/help",
  "/onboarding",
]);

const JARGON_REPLACEMENTS: Record<string, string> = {
  tokens: "AI credits",
  token: "AI credit",
  quota: "AI credits",
};
const ASSISTANT_CONTEXT_CHAR_BUDGET = 5800;
const AI_CAP_ERROR_CODES = new Set([
  "AI_DAILY_CAP_EXCEEDED",
  "AI_DAILY_REQUEST_CAP_EXCEEDED",
  "AI_DAILY_TOKEN_CAP_EXCEEDED",
  "AI_TOKEN_BUDGET_EXCEEDED",
  "AI_DISABLED",
]);

type IntentToolKey =
  | "get_business_summary"
  | "get_sms_usage"
  | "get_billing_status"
  | "get_ai_usage"
  | "route_guidance";

type AssistantIntentRegistry = Record<
  AssistantIntent,
  {
    requiredTools: IntentToolKey[];
    optionalTools: IntentToolKey[];
    minConfidence: number;
  }
>;

type AssistantToolExecutionResult = {
  tool: IntentToolKey;
  status: "ok" | "skipped" | "error";
  output?: unknown;
};

type AssistantOrchestrationStageResult = {
  stage:
    | "normalize"
    | "intent"
    | "context"
    | "tools"
    | "openai"
    | "validate"
    | "finalize";
  status: "ok" | "warn" | "error";
  detail: string;
};

type ModelAssistantPayload = {
  plainAnswer?: string;
  nextStep?: string;
  details?: string;
  intentKey?: AssistantIntent;
  usedTools?: string[];
  actionChips?: Array<
    Partial<AssistantActionChip> & {
      action?: string;
      url?: string;
    }
  >;
  confidence?: number | string;
};
type NormalizedModelAssistantPayload = Omit<ModelAssistantPayload, "actionChips" | "confidence"> & {
  actionChips?: AssistantActionChip[];
  confidence?: number;
};

type AssistantValidationErrorReason =
  | "schema_invalid"
  | "unsupported_tool"
  | "low_confidence";

const INTENT_REGISTRY: AssistantIntentRegistry = {
  usage: {
    requiredTools: ["get_sms_usage", "get_billing_status", "get_ai_usage"],
    optionalTools: ["route_guidance"],
    minConfidence: 0.82,
  },
  metrics: {
    requiredTools: ["get_business_summary"],
    optionalTools: ["route_guidance"],
    minConfidence: 0.84,
  },
  how_to: {
    requiredTools: ["route_guidance"],
    optionalTools: [],
    minConfidence: 0.72,
  },
  troubleshooting: {
    requiredTools: ["route_guidance"],
    optionalTools: ["get_billing_status"],
    minConfidence: 0.75,
  },
  general: {
    requiredTools: ["route_guidance"],
    optionalTools: [],
    minConfidence: 0.7,
  },
};

@Injectable()
export class AssistantService {
  constructor(
    private readonly answerSource: AnswerSourceService,
    private readonly aiExecution: AiExecutionService,
    private readonly threadMemory: AssistantThreadMemoryService,
  ) {}

  async chat(input: {
    organizationId: string;
    userId: string;
    message: string;
    businessId?: string;
    threadId?: string;
  }): Promise<AssistantChatResponse> {
    const run = await this.orchestrate(input);
    return run.response;
  }

  async chatStream(input: {
    organizationId: string;
    userId: string;
    message: string;
    businessId?: string;
    threadId?: string;
  }): Promise<AssistantChatStreamEvent[]> {
    const threadId = input.threadId?.trim() || `thread-${input.userId}`;
    const intent = this.detectIntent(input.message);
    const events: AssistantChatStreamEvent[] = [
      { type: "meta", threadId, intent },
      { type: "state", state: "sending" },
      { type: "stage", stage: "normalize" },
      { type: "stage", stage: "intent" },
      { type: "state", state: "streaming" },
    ];

    try {
      const run = await this.orchestrate(input);
      if (run.response.fallback?.reason === "capped") {
        events.push({ type: "state", state: "error" });
        events.push({
          type: "error",
          code: "AI_DAILY_CAP_EXCEEDED",
          message: "You reached today’s AI limit.",
          actionChips: [
            { label: "View AI Usage", href: "/settings", kind: "primary" },
            { label: "Open Help Center", href: "/help", kind: "secondary" },
          ],
        });
        return events;
      }
      const validateError = run.stages.find((stage) => stage.stage === "validate" && stage.status === "error");
      if (run.response.fallback?.reason === "low_confidence" && validateError) {
        events.push({ type: "state", state: "error" });
        events.push({
          type: "error",
          code: validateError.detail.toUpperCase(),
          message: "I could not safely format this answer yet. Please try again.",
          actionChips: run.response.actionChips,
        });
        return events;
      }
      events.push({ type: "stage", stage: "context" });
      events.push({ type: "stage", stage: "tools" });
      events.push({ type: "stage", stage: "openai" });
      events.push({ type: "stage", stage: "finalize" });
      for (const chunk of this.chunkText(run.response.plainAnswer)) {
        events.push({ type: "delta", chunk });
      }
      events.push({ type: "actions", actionChips: run.response.actionChips });
      const usageEvent = await this.buildUsageStreamEvent(input.organizationId);
      if (usageEvent) {
        events.push(usageEvent);
      }
      events.push({ type: "state", state: "sent" });
      events.push({ type: "state", state: "read" });
      events.push({ type: "done", response: run.response });
      return events;
    } catch (error) {
      const reason = this.extractErrorReason(error);
      if (reason && AI_CAP_ERROR_CODES.has(reason)) {
        events.push({ type: "state", state: "error" });
        events.push({
          type: "error",
          code: reason,
          message: "You reached today’s AI limit.",
          actionChips: [
            { label: "View AI Usage", href: "/settings", kind: "primary" },
            { label: "Open Help Center", href: "/help", kind: "secondary" },
          ],
        });
        return events;
      }
      events.push({ type: "state", state: "error" });
      events.push({ type: "error", message: "Unable to process your request right now." });
      return events;
    }
  }

  private async orchestrate(input: {
    organizationId: string;
    userId: string;
    message: string;
    businessId?: string;
    threadId?: string;
  }): Promise<{ response: AssistantChatResponse; stages: AssistantOrchestrationStageResult[] }> {
    const stages: AssistantOrchestrationStageResult[] = [];
    const normalizedMessage = input.message.trim();
    const intent = this.detectIntent(normalizedMessage);
    const locale = this.detectLocale(normalizedMessage);
    const registry = INTENT_REGISTRY[intent];
    const threadId = input.threadId?.trim() || `thread-${input.userId}`;

    stages.push({ stage: "normalize", status: "ok", detail: "message normalized" });
    stages.push({ stage: "intent", status: "ok", detail: `intent=${intent}` });

    const memory = await this.safeLoadMemory(input.organizationId, input.userId, threadId);
    const toolExecution = await this.executeIntentTools(intent, input.organizationId, input.businessId);
    const dataContext = this.buildDataContextFromToolExecution(toolExecution);
    const contextPack = buildAssistantContextPack({
      intent,
      locale,
      query: normalizedMessage,
      memory,
      dataContext,
    });
    const defaultChips = this.defaultChipsForIntent(intent, normalizedMessage);

    if ((contextPack.task_context.helpArticles?.length ?? 0) === 0 && intent !== "general") {
      stages.push({ stage: "context", status: "error", detail: "missing context docs for intent" });
      const fallback = this.withThreadId(this.fallback("no_source", defaultChips), threadId);
      return { response: fallback, stages };
    }
    stages.push({ stage: "context", status: "ok", detail: "context pack loaded" });

    if (!this.aiExecution.hasOpenAi()) {
      stages.push({ stage: "openai", status: "error", detail: "openai unavailable" });
      return { response: this.withThreadId(this.fallback("no_source", defaultChips), threadId), stages };
    }

    stages.push({ stage: "tools", status: "ok", detail: `tools=${toolExecution.map((t) => `${t.tool}:${t.status}`).join(",")}` });

    let normalized: AssistantChatResponse | null = null;
    let lastValidationError: AssistantValidationErrorReason = "schema_invalid";
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const strictness = attempt;
      try {
        const modelContext = this.buildContextWithinBudget(
          contextPack,
          normalizedMessage,
          ASSISTANT_CONTEXT_CHAR_BUDGET,
        );
        const response = await this.aiExecution.executeWithGuardrails(
          input.organizationId,
          input.userId,
          "summarization",
          [
            {
              role: "system",
              content: this.buildSystemPrompt(strictness, registry),
            },
            {
              role: "user",
              content: JSON.stringify({
                question: normalizedMessage,
                context: modelContext,
                toolResults: toolExecution,
              }),
            },
          ],
          {
            businessId: input.businessId,
            maxTokens: 500,
            temperature: 0.2,
            responseFormat: this.assistantResponseJsonSchema(),
          },
        );

        const parsed = this.tryParseAssistantResponse(response.content);
        if (!parsed) {
          lastValidationError = "schema_invalid";
          continue;
        }

        const normalizedPayload = this.normalizeModelPayload(parsed);
        const toolUsageValidation = this.validateToolUsage(normalizedPayload.usedTools ?? []);
        if (!toolUsageValidation.ok) {
          lastValidationError = toolUsageValidation.reason;
          normalized = null;
          continue;
        }
        normalizedPayload.actionChips = this.retainWhitelistedRoutes(normalizedPayload.actionChips);
        normalizedPayload.usedTools = this.ensureRequiredTools(normalizedPayload.usedTools ?? [], registry);

        normalized = this.normalizeResponse(normalizedPayload, defaultChips);
        const minConfidence = Math.max(registry.minConfidence, strictness === 0 ? 0.72 : strictness === 1 ? 0.8 : 0.88);
        if (normalized.confidence < minConfidence) {
          lastValidationError = "low_confidence";
          normalized = null;
          continue;
        }

        if (!normalized.plainAnswer || !normalized.nextStep || normalized.actionChips.length === 0) {
          lastValidationError = "schema_invalid";
          normalized = null;
          continue;
        }

        stages.push({ stage: "openai", status: "ok", detail: `resolved on attempt=${attempt + 1}` });
        break;
      } catch (error) {
        const reason = this.extractErrorReason(error);
        if (reason && AI_CAP_ERROR_CODES.has(reason)) {
          const capped = this.cappedResponse(defaultChips);
          await this.safeSaveMemory(
            input.organizationId,
            input.userId,
            threadId,
            memory.turns,
            normalizedMessage,
            `${capped.plainAnswer} ${capped.nextStep}`.trim(),
          );
          return { response: this.withThreadId(capped, threadId), stages };
        }
      }
    }

    if (!normalized) {
      stages.push({ stage: "validate", status: "error", detail: lastValidationError });
      const fallback = this.fallback("low_confidence", defaultChips);
      await this.safeSaveMemory(
        input.organizationId,
        input.userId,
        threadId,
        memory.turns,
        normalizedMessage,
        `${fallback.plainAnswer} ${fallback.nextStep}`.trim(),
      );
      return { response: this.withThreadId(fallback, threadId), stages };
    }

    stages.push({ stage: "validate", status: "ok", detail: "response normalized" });

    await this.safeSaveMemory(
      input.organizationId,
      input.userId,
      threadId,
      memory.turns,
      normalizedMessage,
      `${normalized.plainAnswer} ${normalized.nextStep}`.trim(),
    );

    const finalResponse = this.withThreadId(normalized, threadId);
    stages.push({ stage: "finalize", status: "ok", detail: "thread memory saved" });
    return { response: finalResponse, stages };
  }

  private isKnownTool(tool: string): tool is IntentToolKey {
    return [
      "get_business_summary",
      "get_sms_usage",
      "get_billing_status",
      "get_ai_usage",
      "route_guidance",
    ].includes(tool);
  }

  private async executeIntentTools(
    intent: AssistantIntent,
    organizationId: string,
    businessId?: string,
  ): Promise<AssistantToolExecutionResult[]> {
    if (intent === "usage") {
      const [smsUsage, billingStatus, aiUsage] = await Promise.all([
        this.answerSource.getSmsUsage({ organizationId }),
        this.answerSource.getBillingStatus({ organizationId }),
        this.answerSource.getAiUsageSummary({ organizationId }),
      ]);
      return [
        { tool: "get_sms_usage", status: "ok", output: smsUsage },
        { tool: "get_billing_status", status: "ok", output: billingStatus },
        { tool: "get_ai_usage", status: "ok", output: aiUsage },
      ];
    }

    if (intent === "metrics") {
      if (!businessId) {
        return [
          { tool: "get_business_summary", status: "skipped", output: { reason: "missing_business_scope" } },
          { tool: "route_guidance", status: "ok", output: { insights: "/insights" } },
        ];
      }
      const businessSummary = await this.answerSource.getBusinessSummary({ organizationId, businessId });
      return [
        { tool: "get_business_summary", status: "ok", output: businessSummary },
        { tool: "route_guidance", status: "ok", output: { insights: "/insights" } },
      ];
    }

    return [
      {
        tool: "route_guidance",
        status: "ok",
        output: {
          customers: "/customers",
          appointments: "/appointments",
          settings: "/settings",
          help: "/help",
          dashboard: "/dashboard",
        },
      },
    ];
  }

  private buildDataContextFromToolExecution(results: AssistantToolExecutionResult[]) {
    return results.reduce<Record<string, unknown>>((acc, result) => {
      acc[result.tool] = {
        status: result.status,
        output: result.output,
      };
      return acc;
    }, {});
  }

  private detectIntent(message: string): AssistantIntent {
    const m = message.toLowerCase();
    if (m.includes("error") || m.includes("not working") || m.includes("can't") || m.includes("cannot")) return "troubleshooting";
    if (
      m.includes("sms") ||
      m.includes("usage") ||
      m.includes("token") ||
      m.includes("quota") ||
      m.includes("credit")
    ) return "usage";
    if (m.includes("sales") || m.includes("month") || m.includes("summary") || m.includes("insight")) return "metrics";
    if (
      m.includes("how") ||
      m.includes("paano") ||
      m.includes("add") ||
      m.includes("create") ||
      m.includes("where") ||
      m.includes("slot") ||
      m.includes("schedule") ||
      m.includes("appointment")
    ) return "how_to";
    return "general";
  }

  private defaultChipsForIntent(intent: AssistantIntent, message: string): AssistantActionChip[] {
    const m = message.toLowerCase();
    if (intent === "usage") {
      return [
        { label: "View AI usage", href: "/settings", kind: "primary" },
        { label: "Open Help Center", href: "/help", kind: "secondary" },
      ];
    }
    if (intent === "metrics") {
      return [
        { label: "View monthly summary", href: "/insights", kind: "primary" },
        { label: "Open dashboard", href: "/dashboard", kind: "secondary" },
      ];
    }
    if (intent === "how_to") {
      if (m.includes("slot") || m.includes("schedule") || m.includes("appointment")) {
        return [
          { label: "Open appointments", href: "/appointments", kind: "primary" },
          { label: "Open Help Center", href: "/help", kind: "secondary" },
        ];
      }
      return [
        { label: "Add customer now", href: "/customers", kind: "primary" },
        { label: "Open Help Center", href: "/help", kind: "secondary" },
      ];
    }
    if (intent === "troubleshooting") {
      return [
        { label: "Open Help Center", href: "/help", kind: "primary" },
        { label: "Open settings", href: "/settings", kind: "secondary" },
      ];
    }
    return [
      { label: "Open dashboard", href: "/dashboard", kind: "primary" },
      { label: "Open Help Center", href: "/help", kind: "secondary" },
    ];
  }

  private detectLocale(message: string): "en" | "tl" {
    const m = message.toLowerCase();
    if (m.includes("paano") || m.includes("ilan") || m.includes("natitira")) return "tl";
    return "en";
  }

  private buildSystemPrompt(
    strictness: number,
    registry: AssistantIntentRegistry[AssistantIntent],
  ): string {
    const base = [
      "You are Tyvera Assistant for non-technical users.",
      "Return strict JSON with keys: plainAnswer, nextStep, details, actionChips, confidence, intentKey, usedTools.",
      "plainAnswer must be short and easy to understand.",
      "nextStep must be one direct action sentence.",
      "actionChips must include one primary and up to two secondary actions.",
      "Avoid jargon. Prefer 'AI credits' over technical terms.",
      "If data is uncertain, be explicit and avoid guessing.",
      `usedTools must include required tools: ${registry.requiredTools.join(",")}`,
      "Do not include any tool outside allowed list: get_business_summary,get_sms_usage,get_billing_status,get_ai_usage,route_guidance.",
    ];

    if (strictness >= 1) {
      base.push("Only answer from provided context. Do not invent numbers or routes. Output JSON only.");
    }
    if (strictness >= 2) {
      base.push("Confidence must reflect certainty from provided context only. Use fallback-style wording when uncertain. No markdown.");
    }
    return base.join(" ");
  }

  private tryParseAssistantResponse(content: string): ModelAssistantPayload | null {
    const attempts: string[] = [content];
    const codeBlock = this.extractJsonCodeBlock(content);
    if (codeBlock) attempts.push(codeBlock);
    const objectBlock = this.extractJsonObject(content);
    if (objectBlock) attempts.push(objectBlock);

    for (const candidate of attempts) {
      const parsed = this.tryParseJson(candidate);
      if (parsed) return parsed;
      const repaired = this.repairLikelyJson(candidate);
      const reparsed = this.tryParseJson(repaired);
      if (reparsed) return reparsed;
    }
    return null;
  }

  private tryParseJson(content: string): ModelAssistantPayload | null {
    try {
      return JSON.parse(content) as ModelAssistantPayload;
    } catch {
      return null;
    }
  }

  private extractJsonCodeBlock(content: string): string | null {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    return match?.[1]?.trim() ?? null;
  }

  private extractJsonObject(content: string): string | null {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    return content.slice(start, end + 1).trim();
  }

  private repairLikelyJson(content: string): string {
    return content
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/[\u0000-\u001f]/g, " ")
      .trim();
  }

  private normalizeResponse(
    parsed: NormalizedModelAssistantPayload,
    fallbackChips: AssistantActionChip[],
  ): AssistantChatResponse {
    const sanitized = this.sanitizeChips(parsed.actionChips, fallbackChips);
    return {
      plainAnswer: this.simplifyText(parsed.plainAnswer ?? ""),
      nextStep: this.simplifyText(parsed.nextStep ?? ""),
      details: parsed.details ? this.simplifyText(parsed.details) : undefined,
      actionChips: sanitized,
      confidence: this.clampConfidence(parsed.confidence),
    };
  }

  private simplifyText(text: string): string {
    let out = text.trim();
    for (const [from, to] of Object.entries(JARGON_REPLACEMENTS)) {
      const re = new RegExp(`\\b${from}\\b`, "gi");
      out = out.replace(re, to);
    }
    const sentences = out.split(/(?<=[.!?])\s+/).filter(Boolean);
    const limited = sentences.slice(0, 2).join(" ");
    return limited.length > 220 ? `${limited.slice(0, 217)}...` : limited;
  }

  private sanitizeChips(chips: AssistantActionChip[] | undefined, fallbackChips: AssistantActionChip[]): AssistantActionChip[] {
    const source = (chips ?? fallbackChips).filter((chip) => SAFE_ROUTE_WHITELIST.has(chip.href));
    const primary = source.find((chip) => chip.kind === "primary") ?? fallbackChips.find((chip) => chip.kind === "primary");
    const secondary = source.filter((chip) => chip.kind === "secondary").slice(0, 2);
    const merged = [primary, ...secondary].filter(Boolean) as AssistantActionChip[];
    return merged.slice(0, 3);
  }

  private validateToolUsage(usedTools: string[]): { ok: true } | { ok: false; reason: AssistantValidationErrorReason } {
    if (usedTools.some((tool) => !this.isKnownTool(tool))) {
      return { ok: false, reason: "unsupported_tool" };
    }
    return { ok: true };
  }

  private normalizeModelPayload(parsed: ModelAssistantPayload): NormalizedModelAssistantPayload {
    const chips = Array.isArray(parsed.actionChips)
      ? parsed.actionChips
          .map((chip) => {
            const href = typeof chip.href === "string" ? chip.href : typeof chip.action === "string" ? chip.action : typeof chip.url === "string" ? chip.url : "";
            const kind = chip.kind === "secondary" ? "secondary" : "primary";
            return {
              label: String(chip.label ?? "").trim(),
              href: href.trim(),
              kind,
            } satisfies AssistantActionChip;
          })
          .filter((chip) => chip.label && chip.href)
      : undefined;

    const confidence = typeof parsed.confidence === "string"
      ? this.mapConfidenceString(parsed.confidence)
      : parsed.confidence;

    return {
      ...parsed,
      actionChips: chips,
      confidence,
      usedTools: Array.isArray(parsed.usedTools) ? parsed.usedTools.map((tool) => String(tool)) : [],
    };
  }

  private mapConfidenceString(confidence: string): number {
    const value = confidence.trim().toLowerCase();
    if (value === "high") return 0.92;
    if (value === "medium") return 0.7;
    if (value === "low") return 0.45;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    return 0.5;
  }

  private retainWhitelistedRoutes(chips: AssistantActionChip[] | undefined): AssistantActionChip[] | undefined {
    if (!chips) return undefined;
    return chips.filter((chip) => SAFE_ROUTE_WHITELIST.has(chip.href));
  }

  private ensureRequiredTools(usedTools: string[], registry: AssistantIntentRegistry[AssistantIntent]): string[] {
    const merged = new Set<string>(usedTools);
    for (const req of registry.requiredTools) {
      merged.add(req);
    }
    return [...merged];
  }

  private assistantResponseJsonSchema(): {
    type: "json_schema";
    json_schema: {
      name: string;
      strict: true;
      schema: { [key: string]: unknown };
    };
  } {
    return {
      type: "json_schema" as const,
      json_schema: {
        name: "assistant_chat_response",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["plainAnswer", "nextStep", "details", "actionChips", "confidence", "intentKey", "usedTools"],
          properties: {
            plainAnswer: { type: "string" },
            nextStep: { type: "string" },
            details: { type: ["string", "null"] },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            intentKey: { type: "string" },
            usedTools: {
              type: "array",
              items: { type: "string" },
            },
            actionChips: {
              type: "array",
              minItems: 1,
              maxItems: 3,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["label", "href", "kind"],
                properties: {
                  label: { type: "string" },
                  href: { type: "string" },
                  kind: { type: "string", enum: ["primary", "secondary"] },
                },
              },
            },
          },
        },
      },
    };
  }

  private clampConfidence(value: number | undefined): number {
    if (typeof value !== "number" || Number.isNaN(value)) return 0.5;
    return Math.max(0, Math.min(1, value));
  }

  private fallback(reason: "low_confidence" | "no_source", chips: AssistantActionChip[]): AssistantChatResponse {
    return {
      plainAnswer: "I’m not fully sure yet based on available app data.",
      nextStep: "Use the buttons below so I can guide you to the right place.",
      details: "I only answer from trusted app sources to avoid wrong information.",
      actionChips: this.sanitizeChips(undefined, chips),
      confidence: 0.4,
      fallback: { reason },
    };
  }

  private cappedResponse(chips: AssistantActionChip[]): AssistantChatResponse {
    return {
      plainAnswer: "You reached today’s AI limit.",
      nextStep: "Check your daily AI usage, or continue using Help Center guides for now.",
      details: "Daily limits protect usage fairness. You can continue after daily reset or with higher limits.",
      actionChips: this.sanitizeChips(
        [
          { label: "View AI Usage", href: "/settings", kind: "primary" },
          { label: "Open Help Center", href: "/help", kind: "secondary" },
        ],
        chips,
      ),
      confidence: 1,
      fallback: { reason: "capped" },
    };
  }

  private extractErrorReason(error: unknown): string | null {
    const err = error as { message?: string; response?: { message?: string | string[] } };
    const nested = err?.response?.message;
    if (Array.isArray(nested) && nested.length > 0) return String(nested[0]);
    if (typeof nested === "string" && nested.trim()) return nested;
    if (typeof err?.message === "string" && err.message.trim()) return err.message;
    return null;
  }

  private async safeLoadMemory(organizationId: string, userId: string, threadId: string): Promise<{ summary: string; turns: Array<{ role: "user" | "assistant"; text: string }> }> {
    try {
      return await this.threadMemory.getThreadMemory(organizationId, userId, threadId);
    } catch {
      return { summary: "", turns: [] };
    }
  }

  private async safeSaveMemory(
    organizationId: string,
    userId: string,
    threadId: string,
    existingTurns: Array<{ role: "user" | "assistant"; text: string }>,
    userMessage: string,
    assistantMessage: string,
  ) {
    try {
      const turns = [
        ...existingTurns,
        { role: "user" as const, text: userMessage },
        { role: "assistant" as const, text: assistantMessage },
      ].slice(-8);
      const summary = turns
        .slice(-4)
        .map((t) => `${t.role}: ${t.text}`)
        .join(" | ")
        .slice(0, 600);
      await this.threadMemory.saveThreadMemory(organizationId, userId, threadId, turns, summary);
    } catch {
      // Non-fatal: assistant response should still return.
    }
  }

  private withThreadId(response: AssistantChatResponse, threadId: string): AssistantChatResponse {
    return { ...response, threadId };
  }

  private async buildUsageStreamEvent(organizationId: string): Promise<Extract<AssistantChatStreamEvent, { type: "usage" }> | null> {
    try {
      const usage = await this.answerSource.getAiUsageSummary({ organizationId });
      const canonical = usage.canonical;
      if (!canonical) return null;
      return {
        type: "usage",
        usage: {
          tokensUsed: canonical.tokensUsed,
          tokensLimit: canonical.tokensLimit,
          requestsUsed: canonical.requestsUsed,
          requestsLimit: canonical.requestsLimit,
          dailyTokensUsed: canonical.dailyTokensUsed,
          dailyTokensLimit: canonical.dailyTokensLimit,
          dailyRequestsUsed: canonical.dailyRequestsUsed,
          dailyRequestsLimit: canonical.dailyRequestsLimit,
          dailyResetDateTime: canonical.dailyResetDateTime,
          resetDate: canonical.resetDate,
        },
      };
    } catch {
      return null;
    }
  }

  private chunkText(text: string): string[] {
    const trimmed = text.trim();
    if (!trimmed) return [];
    const words = trimmed.split(/\s+/);
    const chunks: string[] = [];
    for (let index = 0; index < words.length; index += 4) {
      const slice = words.slice(index, index + 4).join(" ");
      chunks.push(index + 4 < words.length ? `${slice} ` : slice);
    }
    return chunks;
  }

  private buildContextWithinBudget(
    contextPack: ReturnType<typeof buildAssistantContextPack>,
    question: string,
    maxChars: number,
  ) {
    const clone = JSON.parse(JSON.stringify(contextPack)) as ReturnType<typeof buildAssistantContextPack>;
    const payloadLength = () =>
      JSON.stringify({
        question,
        context: clone,
      }).length;

    const getArticles = () => clone.task_context.helpArticles ?? [];
    while (payloadLength() > maxChars && getArticles().length > 3) {
      getArticles().pop();
    }

    if (payloadLength() > maxChars) {
      for (const article of getArticles()) {
        if (Array.isArray(article.steps) && article.steps.length > 4) {
          article.steps = article.steps.slice(0, 4);
        }
      }
    }

    if (payloadLength() > maxChars) {
      for (const article of getArticles()) {
        if (Array.isArray(article.steps)) {
          article.steps = article.steps.map((step) => String(step).slice(0, 120));
        }
      }
    }

    if (payloadLength() > maxChars && Array.isArray(clone.memory_context.turns)) {
      clone.memory_context.turns = clone.memory_context.turns.slice(-2);
    }

    if (payloadLength() > maxChars) {
      clone.memory_context.summary = String(clone.memory_context.summary ?? "").slice(0, 220);
    }

    return clone;
  }
}
