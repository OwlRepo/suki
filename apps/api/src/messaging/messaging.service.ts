import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { getDb } from "@tyvera/database";
import { aiCredits, businesses } from "@tyvera/database";
import { eq, and } from "drizzle-orm";
import { AiExecutionService } from "../ai/ai-execution.service";

const DEFAULT_MONTHLY_CREDITS = 100;

@Injectable()
export class MessagingService {
  constructor(private readonly aiExecution: AiExecutionService) {}

  hasOpenAi(): boolean {
    return this.aiExecution.hasOpenAi();
  }

  async getCredits(organizationId: string): Promise<{
    allocated: number;
    used: number;
    remaining: number;
    month: string;
  }> {
    const month = this.currentMonth();
    const row = await this.getOrCreateCreditsRow(organizationId, month);
    return {
      allocated: row.allocated,
      used: row.used,
      remaining: Math.max(0, row.allocated - row.used),
      month,
    };
  }

  async generate(
    organizationId: string,
    userId: string,
    businessId: string,
    prompt: string,
    context?: Record<string, unknown>,
  ): Promise<{ generatedMessage: string; creditsUsed: number }> {
    if (!this.aiExecution.hasOpenAi()) {
      throw new ServiceUnavailableException(
        "AI message generation is not configured. Set OPENAI_API_KEY.",
      );
    }
    if (!prompt?.trim()) {
      throw new BadRequestException("Prompt is required");
    }
    await this.assertBusinessAccess(businessId, organizationId);

    const systemPrompt = this.buildSystemPrompt(context);
    const { content } = await this.aiExecution.executeWithGuardrails(
      organizationId,
      userId,
      "drafting",
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      { businessId, maxTokens: 300 },
    );

    return {
      generatedMessage: content,
      creditsUsed: 1,
    };
  }

  private currentMonth(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  private async getOrCreateCreditsRow(
    organizationId: string,
    month: string,
  ): Promise<{ allocated: number; used: number }> {
    const db = getDb();
    const [existing] = await db
      .select()
      .from(aiCredits)
      .where(
        and(
          eq(aiCredits.organizationId, organizationId),
          eq(aiCredits.month, month),
        ),
      )
      .limit(1);

    if (existing) {
      return { allocated: existing.allocated, used: existing.used };
    }

    const [created] = await db
      .insert(aiCredits)
      .values({
        organizationId,
        month,
        allocated: DEFAULT_MONTHLY_CREDITS,
        used: 0,
      })
      .returning();

    return {
      allocated: created?.allocated ?? DEFAULT_MONTHLY_CREDITS,
      used: created?.used ?? 0,
    };
  }

  private async assertBusinessAccess(businessId: string, organizationId: string) {
    const db = getDb();
    const [biz] = await db
      .select()
      .from(businesses)
      .where(
        and(
          eq(businesses.id, businessId),
          eq(businesses.organizationId, organizationId),
        ),
      )
      .limit(1);
    if (!biz) throw new ForbiddenException("Business not found");
  }

  private buildSystemPrompt(context?: Record<string, unknown>): string {
    let base =
      "You are a helpful assistant for a Philippine small business. " +
      "Generate concise, friendly SMS-style messages for customer engagement. " +
      "Keep messages under 160 characters when possible. Use a warm, professional tone.";
    if (context?.businessType) {
      base += ` Business type: ${context.businessType}.`;
    }
    return base;
  }
}
