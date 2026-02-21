import { Injectable, ForbiddenException } from "@nestjs/common";
import { AiPolicyService } from "./ai-policy.service";
import { AiRateLimiterService } from "./ai-rate-limiter.service";
import { AiConcurrencyService } from "./ai-concurrency.service";
import { AiIdempotencyService } from "./ai-idempotency.service";
import { AiUsageService } from "./ai-usage.service";
import { PlanCapacityService } from "../common/plan-capacity.service";

const ESTIMATED_TOKENS_PER_REQUEST = 500;

@Injectable()
export class AiService {
  constructor(
    private readonly policy: AiPolicyService,
    private readonly rateLimiter: AiRateLimiterService,
    private readonly concurrency: AiConcurrencyService,
    private readonly idempotency: AiIdempotencyService,
    private readonly usage: AiUsageService,
    private readonly planCapacity: PlanCapacityService,
  ) {}

  async checkAndExecute(
    organizationId: string,
    userId: string,
    feature: string,
    payload: unknown,
    opts?: { businessId?: string; estimatedPromptTokens?: number; contextRecordCount?: number },
  ): Promise<{ ok: boolean; message?: string }> {
    const plan = await this.planCapacity.getActivePlan(organizationId);
    const estimatedPrompt = opts?.estimatedPromptTokens ?? 200;
    const contextCount = opts?.contextRecordCount ?? 0;

    await this.policy.checkFeatureAccess(organizationId, userId, feature);

    const inputCheck = this.policy.validateInput(estimatedPrompt, contextCount, plan);
    if (!inputCheck.valid) {
      throw new ForbiddenException(inputCheck.reason ?? "AI_INPUT_VALIDATION_FAILED");
    }

    const idem = await this.idempotency.check(organizationId, userId, feature, payload);
    if (!idem.allowed) {
      throw new ForbiddenException("AI_IDEMPOTENCY_WINDOW");
    }

    const rate = await this.rateLimiter.allow(organizationId, userId, feature);
    if (!rate.allowed) {
      throw new ForbiddenException(rate.reason ?? "AI_RATE_LIMITED");
    }

    const { acquired, release } = await this.concurrency.acquire(organizationId);
    if (!acquired) {
      throw new ForbiddenException("AI_CONCURRENCY_LIMIT");
    }
    try {
      const budget = await this.usage.checkBudget(organizationId, ESTIMATED_TOKENS_PER_REQUEST);
      if (!budget.allowed) {
        throw new ForbiddenException(budget.reason ?? "AI_TOKEN_BUDGET_EXCEEDED");
      }
      return { ok: true };
    } finally {
      release();
    }
  }

  async executeAndRecord(
    organizationId: string,
    userId: string,
    feature: string,
    payload: unknown,
    opts?: { businessId?: string; estimatedPromptTokens?: number; contextRecordCount?: number },
  ): Promise<{ ok: boolean; message?: string }> {
    const result = await this.checkAndExecute(
      organizationId,
      userId,
      feature,
      payload,
      opts,
    );
    if (!result.ok) return result;
    const plan = await this.planCapacity.getActivePlan(organizationId);
    const estimatedPrompt = opts?.estimatedPromptTokens ?? 200;
    const completionTokens = this.policy.getMaxOutputTokens(plan, feature);
    const totalTokens = estimatedPrompt + completionTokens;
    await this.usage.recordUsage(
      organizationId,
      userId,
      opts?.businessId ?? null,
      feature,
      "gpt-4o-mini",
      estimatedPrompt,
      completionTokens,
      totalTokens,
    );
    return result;
  }
}
