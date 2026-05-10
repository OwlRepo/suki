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
    const intent = this.detectIntent(input.message);
    const threadId = input.threadId?.trim() || `thread-${input.userId}`;
    const memory = await this.safeLoadMemory(input.organizationId, input.userId, threadId);
    const dataContext = await this.buildDataContext(intent, input);
    const contextPack = buildAssistantContextPack({
      intent,
      locale: this.detectLocale(input.message),
      memory,
      dataContext,
    });
    const defaultChips = this.defaultChipsForIntent(intent, input.message);

    if (!this.aiExecution.hasOpenAi()) {
      return this.withThreadId(this.fallback("no_source", defaultChips), threadId);
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const strictness = attempt;
      try {
        const response = await this.aiExecution.executeWithGuardrails(
          input.organizationId,
          input.userId,
          "summarization",
          [
            {
              role: "system",
              content: this.buildSystemPrompt(strictness),
            },
            {
              role: "user",
              content: JSON.stringify({
                question: input.message,
                context: contextPack,
              }),
            },
          ],
          { businessId: input.businessId, maxTokens: 450, temperature: 0.2 },
        );

        const parsed = this.tryParseAssistantResponse(response.content);
        if (!parsed) continue;

        const normalized = this.normalizeResponse(parsed, defaultChips);
        const minConfidence = strictness === 0 ? 0.72 : strictness === 1 ? 0.8 : 0.88;
        if (normalized.confidence < minConfidence) continue;
        if (!normalized.plainAnswer || !normalized.nextStep || normalized.actionChips.length === 0) continue;

        await this.safeSaveMemory(
          input.organizationId,
          input.userId,
          threadId,
          memory.turns,
          input.message,
          `${normalized.plainAnswer} ${normalized.nextStep}`.trim(),
        );
        return this.withThreadId(normalized, threadId);
      } catch {
        // Try stricter reruns; if all fail, fallback below.
      }
    }

    const fallback = this.fallback("low_confidence", defaultChips);
    await this.safeSaveMemory(
      input.organizationId,
      input.userId,
      threadId,
      memory.turns,
      input.message,
      `${fallback.plainAnswer} ${fallback.nextStep}`.trim(),
    );
    return this.withThreadId(fallback, threadId);
  }

  async chatStream(input: {
    organizationId: string;
    userId: string;
    message: string;
    businessId?: string;
    threadId?: string;
  }): Promise<AssistantChatStreamEvent[]> {
    const intent = this.detectIntent(input.message);
    const threadId = input.threadId?.trim() || `thread-${input.userId}`;
    const events: AssistantChatStreamEvent[] = [
      { type: "meta", threadId, intent },
      { type: "state", state: "sending" },
      { type: "state", state: "streaming" },
    ];

    try {
      const response = await this.chat(input);
      for (const chunk of this.chunkText(response.plainAnswer)) {
        events.push({ type: "delta", chunk });
      }
      events.push({ type: "actions", actionChips: response.actionChips });
      events.push({ type: "state", state: "sent" });
      events.push({ type: "state", state: "read" });
      events.push({ type: "done", response });
      return events;
    } catch {
      events.push({ type: "state", state: "error" });
      events.push({ type: "error", message: "Unable to process your request right now." });
      return events;
    }
  }

  private detectIntent(message: string): AssistantIntent {
    const m = message.toLowerCase();
    if (m.includes("error") || m.includes("not working") || m.includes("can't") || m.includes("cannot")) return "troubleshooting";
    if (m.includes("sms") || m.includes("usage") || m.includes("token") || m.includes("quota")) return "usage";
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

  private async buildDataContext(intent: AssistantIntent, input: { organizationId: string; businessId?: string }) {
    if (intent === "usage") {
      const [smsUsage, billingStatus, aiUsage] = await Promise.all([
        this.answerSource.getSmsUsage({ organizationId: input.organizationId }),
        this.answerSource.getBillingStatus({ organizationId: input.organizationId }),
        this.answerSource.getAiUsageSummary({ organizationId: input.organizationId }),
      ]);
      return { smsUsage, billingStatus, aiUsage };
    }

    if (intent === "metrics" && input.businessId) {
      const businessSummary = await this.answerSource.getBusinessSummary({
        organizationId: input.organizationId,
        businessId: input.businessId,
      });
      return { businessSummary };
    }

    return {
      routeGuidance: {
        customers: "/customers",
        appointments: "/appointments",
        settings: "/settings",
        help: "/help",
      },
    };
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

  private buildSystemPrompt(strictness: number): string {
    const base = [
      "You are Suki Assistant for non-technical users.",
      "Return strict JSON with keys: plainAnswer, nextStep, details, actionChips, confidence.",
      "plainAnswer must be short and easy to understand.",
      "nextStep must be one direct action sentence.",
      "actionChips must include one primary and up to two secondary actions.",
      "Avoid jargon. Prefer 'AI credits' over technical terms.",
      "If data is uncertain, be explicit and avoid guessing.",
    ];

    if (strictness >= 1) {
      base.push("Only answer from provided context. Do not invent numbers or routes. Output JSON only.");
    }
    if (strictness >= 2) {
      base.push("Confidence must reflect certainty from provided context only. Use fallback-style wording when uncertain. No markdown.");
    }
    return base.join(" ");
  }

  private tryParseAssistantResponse(content: string): Partial<AssistantChatResponse> | null {
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

  private tryParseJson(content: string): Partial<AssistantChatResponse> | null {
    try {
      return JSON.parse(content) as Partial<AssistantChatResponse>;
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
    parsed: Partial<AssistantChatResponse>,
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
}
