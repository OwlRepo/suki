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
export const MAX_ASSISTANT_TOOL_ROUNDS = 4;
export const MAX_ASSISTANT_TOOL_CALLS = 6;

export type ExecuteResponsesToolLoopOptions = {
  organizationId: string;
  userId: string;
  businessId?: string;
  feature: string;
  input: OpenAI.Responses.ResponseInput;
  tools: OpenAI.Responses.Tool[];
  maxToolRounds: number;
  maxOutputTokens?: number;
  temperature?: number;
  text?: OpenAI.Responses.ResponseTextConfig;
  onTextDelta?: (delta: string) => void | Promise<void>;
  executeToolCall: (toolCall: {
    name: string;
    argumentsJson: string;
    callId: string;
  }) => Promise<unknown>;
};

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

  async executeResponsesToolLoopWithGuardrails(
    options: ExecuteResponsesToolLoopOptions,
  ): Promise<{
    content: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    executedTools: Array<{ name: string; callId: string; round: number }>;
  }> {
    if (!this.openai) {
      throw new ServiceUnavailableException(
        "AI is not configured. Set OPENAI_API_KEY.",
      );
    }

    const initialInput = [...options.input];
    const estimatedPromptTokens = Math.max(
      1,
      Math.ceil(
        JSON.stringify(initialInput).length / CHARS_PER_TOKEN_ESTIMATE,
      ),
    );
    const allowedToolNames = new Set(
      options.tools.flatMap((tool) =>
        tool.type === "function" ? [tool.name] : [],
      ),
    );

    this.logger.log(
      JSON.stringify({
        event: "openai.responses.request.start",
        organizationId: options.organizationId,
        userId: options.userId,
        feature: options.feature,
        businessId: options.businessId ?? null,
        estimatedPromptTokens,
        toolCount: allowedToolNames.size,
      }),
    );

    await this.aiService.checkAndExecute(
      options.organizationId,
      options.userId,
      options.feature,
      { input: initialInput, tools: [...allowedToolNames] },
      {
        businessId: options.businessId,
        estimatedPromptTokens,
        contextRecordCount: 0,
      },
    );

    const plan = await this.planCapacity.getActivePlan(
      options.organizationId,
    );
    const maxOutputTokens =
      options.maxOutputTokens ??
      this.policy.getMaxOutputTokens(plan, options.feature);
    const maxToolRounds = Math.min(
      Math.max(0, options.maxToolRounds),
      MAX_ASSISTANT_TOOL_ROUNDS,
    );

    let currentInput: OpenAI.Responses.ResponseInput = initialInput;
    let toolRounds = 0;
    let toolCallCount = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;
    let content = "";
    const executedTools: Array<{
      name: string;
      callId: string;
      round: number;
    }> = [];

    try {
      while (true) {
        const stream = await this.openai.responses.create({
          model: "gpt-4o-mini",
          input: currentInput,
          tools: options.tools,
          tool_choice: "auto",
          parallel_tool_calls: false,
          stream: true,
          max_output_tokens: maxOutputTokens,
          temperature: options.temperature ?? 0.2,
          text: options.text,
        });

        let completedResponse: OpenAI.Responses.Response | null = null;
        let roundContent = "";

        for await (const event of stream) {
          if (event.type === "response.output_text.delta") {
            roundContent += event.delta;
            if (options.onTextDelta) {
              await options.onTextDelta(event.delta);
            }
            continue;
          }
          if (event.type === "response.completed") {
            completedResponse = event.response;
            continue;
          }
          if (
            event.type === "error" ||
            event.type === "response.failed" ||
            event.type === "response.incomplete"
          ) {
            throw new Error("AI_PROVIDER_STREAM_FAILED");
          }
        }

        if (!completedResponse) {
          throw new Error("AI_PROVIDER_STREAM_FAILED");
        }

        const fallbackInputTokens = Math.max(
          1,
          Math.ceil(
            JSON.stringify(currentInput).length / CHARS_PER_TOKEN_ESTIMATE,
          ),
        );
        const roundPromptTokens =
          completedResponse.usage?.input_tokens ?? fallbackInputTokens;
        const roundCompletionTokens =
          completedResponse.usage?.output_tokens ?? 0;
        const roundTotalTokens =
          completedResponse.usage?.total_tokens ??
          roundPromptTokens + roundCompletionTokens;
        promptTokens += roundPromptTokens;
        completionTokens += roundCompletionTokens;
        totalTokens += roundTotalTokens;

        const functionCalls = completedResponse.output.filter(
          (
            item,
          ): item is OpenAI.Responses.ResponseFunctionToolCall =>
            item.type === "function_call",
        );
        if (functionCalls.length === 0) {
          content = completedResponse.output_text || roundContent;
          break;
        }

        if (toolRounds >= maxToolRounds) {
          this.logger.warn(
            JSON.stringify({
              event: "openai.responses.tool_limit_exceeded",
              organizationId: options.organizationId,
              userId: options.userId,
              feature: options.feature,
              limitType: "rounds",
              limit: maxToolRounds,
            }),
          );
          throw new Error("ASSISTANT_TOOL_ROUND_LIMIT_EXCEEDED");
        }
        if (
          toolCallCount + functionCalls.length >
          MAX_ASSISTANT_TOOL_CALLS
        ) {
          this.logger.warn(
            JSON.stringify({
              event: "openai.responses.tool_limit_exceeded",
              organizationId: options.organizationId,
              userId: options.userId,
              feature: options.feature,
              limitType: "calls",
              limit: MAX_ASSISTANT_TOOL_CALLS,
            }),
          );
          throw new Error("ASSISTANT_TOOL_CALL_LIMIT_EXCEEDED");
        }
        for (const call of functionCalls) {
          if (!allowedToolNames.has(call.name)) {
            throw new Error("UNSUPPORTED_ASSISTANT_TOOL");
          }
        }

        toolRounds += 1;
        toolCallCount += functionCalls.length;
        const outputs: OpenAI.Responses.ResponseInputItem[] = [];
        for (const call of functionCalls) {
          this.logger.log(
            JSON.stringify({
              event: "openai.responses.tool.requested",
              organizationId: options.organizationId,
              userId: options.userId,
              feature: options.feature,
              tool: call.name,
              round: toolRounds,
            }),
          );
          const result = await options.executeToolCall({
            name: call.name,
            argumentsJson: call.arguments,
            callId: call.call_id,
          });
          outputs.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: JSON.stringify(result),
          });
          executedTools.push({
            name: call.name,
            callId: call.call_id,
            round: toolRounds,
          });
          this.logger.log(
            JSON.stringify({
              event: "openai.responses.tool.completed",
              organizationId: options.organizationId,
              userId: options.userId,
              feature: options.feature,
              tool: call.name,
              round: toolRounds,
              status: "completed",
            }),
          );
        }

        currentInput = [
          ...currentInput,
          ...completedResponse.output,
          ...outputs,
        ];
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI_PROVIDER_STREAM_FAILED";
      this.logger.error(
        JSON.stringify({
          event: "openai.responses.request.error",
          organizationId: options.organizationId,
          userId: options.userId,
          feature: options.feature,
          businessId: options.businessId ?? null,
          errorCode: message.startsWith("ASSISTANT_")
            ? message
            : "AI_PROVIDER_STREAM_FAILED",
        }),
      );
      if (
        message === "ASSISTANT_TOOL_ROUND_LIMIT_EXCEEDED" ||
        message === "ASSISTANT_TOOL_CALL_LIMIT_EXCEEDED" ||
        message === "UNSUPPORTED_ASSISTANT_TOOL"
      ) {
        throw error;
      }
      throw new ServiceUnavailableException("AI_PROVIDER_STREAM_FAILED");
    }

    await this.usage.recordUsage(
      options.organizationId,
      options.userId,
      options.businessId ?? null,
      options.feature,
      "gpt-4o-mini",
      promptTokens,
      completionTokens,
      totalTokens,
    );

    this.logger.log(
      JSON.stringify({
        event: "openai.responses.request.success",
        organizationId: options.organizationId,
        userId: options.userId,
        feature: options.feature,
        businessId: options.businessId ?? null,
        model: "gpt-4o-mini",
        promptTokens,
        completionTokens,
        totalTokens,
        toolRounds,
        toolCallCount,
        responsePreview: content.slice(0, 800),
        responseLength: content.length,
      }),
    );

    return {
      content,
      promptTokens,
      completionTokens,
      totalTokens,
      executedTools,
    };
  }
}
