import {
  Injectable,
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
    opts?: { businessId?: string; maxTokens?: number; temperature?: number },
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

    const plan = await this.planCapacity.getActivePlan(organizationId);
    const maxTokens = opts?.maxTokens ?? this.policy.getMaxOutputTokens(plan, feature);

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: maxTokens,
      temperature: opts?.temperature ?? 0.7,
    });

    const promptTokens = completion.usage?.prompt_tokens ?? estimatedPromptTokens;
    const completionTokens = completion.usage?.completion_tokens ?? 0;
    const totalTokens = completion.usage?.total_tokens ?? promptTokens + completionTokens;
    const content = completion.choices[0]?.message?.content?.trim() ?? "";

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
