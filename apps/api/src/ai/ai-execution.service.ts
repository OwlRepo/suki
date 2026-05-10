import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import OpenAI from "openai";
import { AiService } from "./ai.service";
import { AiUsageService } from "./ai-usage.service";
import { AiPolicyService } from "./ai-policy.service";
import { PlanCapacityService } from "../common/plan-capacity.service";

const CHARS_PER_TOKEN_ESTIMATE = 4;

@Injectable()
export class AiExecutionService {
  private openai: OpenAI | null = null;
  private readonly logger = new Logger(AiExecutionService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly usage: AiUsageService,
    private readonly policy: AiPolicyService,
    private readonly planCapacity: PlanCapacityService,
  ) {
    const key = process.env.OPENAI_API_KEY;
    if (key && !key.includes("placeholder")) {
      this.openai = new OpenAI({ apiKey: key });
    }
  }

  hasOpenAi(): boolean {
    return this.openai !== null;
  }

  /**
   * Execute OpenAI chat completion with full guardrail pipeline:
   * entitlement -> idempotency -> rate-limit -> concurrency -> budget -> model call -> usage persist
   */
  async executeWithGuardrails(
    organizationId: string,
    userId: string,
    feature: string,
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    opts?: {
      businessId?: string;
      maxTokens?: number;
      temperature?: number;
      responseFormat?: OpenAI.Chat.Completions.ChatCompletionCreateParams["response_format"];
    },
  ): Promise<{
    content: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }> {
    if (!this.openai) {
      throw new ServiceUnavailableException(
        "AI is not configured. Set OPENAI_API_KEY.",
      );
    }

    const totalChars = messages.reduce((sum, m) => sum + (m.content?.length ?? 0), 0);
    const estimatedPromptTokens = Math.max(1, Math.ceil(totalChars / CHARS_PER_TOKEN_ESTIMATE));
    const redactedMessages = messages.map((message) => ({
      role: message.role,
      // Keep logs useful but bounded so logs remain readable and safer.
      contentPreview: (message.content ?? "").slice(0, 500),
      contentLength: message.content?.length ?? 0,
    }));

    this.logger.log(
      JSON.stringify({
        event: "openai.request.start",
        organizationId,
        userId,
        feature,
        businessId: opts?.businessId ?? null,
        maxTokens: opts?.maxTokens ?? null,
        temperature: opts?.temperature ?? null,
        estimatedPromptTokens,
        messageCount: messages.length,
        messages: redactedMessages,
      }),
    );

    try {
      await this.aiService.checkAndExecute(
        organizationId,
        userId,
        feature,
        { messages },
        {
          businessId: opts?.businessId,
          estimatedPromptTokens,
          contextRecordCount: 0,
        },
      );
    } catch (error) {
      const err = error as { message?: string; name?: string; status?: number; response?: { message?: string } };
      this.logger.warn(
        JSON.stringify({
          event: "openai.request.blocked",
          organizationId,
          userId,
          feature,
          businessId: opts?.businessId ?? null,
          estimatedPromptTokens,
          reason: err?.response?.message ?? err?.message ?? "guardrail check failed",
          errorName: err?.name ?? "Error",
          errorStatus: err?.status ?? null,
        }),
      );
      throw error;
    }

    const plan = await this.planCapacity.getActivePlan(organizationId);
    const maxTokens = opts?.maxTokens ?? this.policy.getMaxOutputTokens(plan, feature);

    let completion: Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
    try {
      completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: maxTokens,
        temperature: opts?.temperature ?? 0.7,
        response_format: opts?.responseFormat,
      });
    } catch (error) {
      const err = error as { message?: string; name?: string; status?: number; code?: string };
      this.logger.error(
        JSON.stringify({
          event: "openai.request.error",
          organizationId,
          userId,
          feature,
          businessId: opts?.businessId ?? null,
          errorName: err?.name ?? "Error",
          errorMessage: err?.message ?? "Unknown OpenAI error",
          errorStatus: err?.status ?? null,
          errorCode: err?.code ?? null,
        }),
      );
      throw error;
    }

    const promptTokens = completion.usage?.prompt_tokens ?? estimatedPromptTokens;
    const completionTokens = completion.usage?.completion_tokens ?? 0;
    const totalTokens = completion.usage?.total_tokens ?? promptTokens + completionTokens;
    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    this.logger.log(
      JSON.stringify({
        event: "openai.request.success",
        organizationId,
        userId,
        feature,
        businessId: opts?.businessId ?? null,
        model: "gpt-4o-mini",
        promptTokens,
        completionTokens,
        totalTokens,
        responsePreview: content.slice(0, 800),
        responseLength: content.length,
      }),
    );

    await this.usage.recordUsage(
      organizationId,
      userId,
      opts?.businessId ?? null,
      feature,
      "gpt-4o-mini",
      promptTokens,
      completionTokens,
      totalTokens,
    );

    return { content, promptTokens, completionTokens, totalTokens };
  }
}
