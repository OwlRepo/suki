import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceUnavailableException } from "@nestjs/common";
import {
  AiExecutionService,
  MAX_ASSISTANT_TOOL_CALLS,
  MAX_ASSISTANT_TOOL_ROUNDS,
} from "./ai-execution.service";

const aiService = { checkAndExecute: vi.fn() };
const usage = { recordUsage: vi.fn() };
const policy = { getMaxOutputTokens: vi.fn() };
const planCapacity = { getActivePlan: vi.fn() };

function asyncStream(events: unknown[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) yield event;
    },
  };
}

function completed(
  output: unknown[],
  outputText: string,
  inputTokens = 10,
  outputTokens = 5,
) {
  return {
    type: "response.completed",
    sequence_number: 2,
    response: {
      id: `response-${Math.random()}`,
      output,
      output_text: outputText,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens_details: { reasoning_tokens: 0 },
      },
    },
  };
}

function delta(text: string) {
  return {
    type: "response.output_text.delta",
    delta: text,
    item_id: "message-1",
    output_index: 0,
    content_index: 0,
    sequence_number: 1,
    logprobs: [],
  };
}

function toolCall(name: string, callId: string, argumentsJson = "{}") {
  return {
    type: "function_call",
    id: `item-${callId}`,
    call_id: callId,
    name,
    arguments: argumentsJson,
    status: "completed",
  };
}

function makeService(client: {
  chat?: { completions: { create: ReturnType<typeof vi.fn> } };
  responses?: { create: ReturnType<typeof vi.fn> };
}) {
  const service = new AiExecutionService(
    aiService as never,
    usage as never,
    policy as never,
    planCapacity as never,
  );
  (service as unknown as { openai: unknown }).openai = client;
  return service;
}

const baseOptions = {
  organizationId: "org-1",
  userId: "user-1",
  businessId: "biz-1",
  feature: "assistant_chat",
  input: [{ role: "user" as const, content: "Help" }],
  tools: [
    {
      type: "function" as const,
      name: "get_sms_usage",
      strict: true,
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {},
        required: [],
      },
    },
  ],
  maxToolRounds: MAX_ASSISTANT_TOOL_ROUNDS,
  executeToolCall: vi.fn(),
};

describe("AiExecutionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiService.checkAndExecute.mockResolvedValue({ ok: true });
    planCapacity.getActivePlan.mockResolvedValue("growth");
    policy.getMaxOutputTokens.mockReturnValue(800);
    usage.recordUsage.mockResolvedValue(undefined);
  });

  it("preserves legacy Chat Completions behavior", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "Legacy result" } }],
      usage: {
        prompt_tokens: 4,
        completion_tokens: 2,
        total_tokens: 6,
      },
    });
    const service = makeService({ chat: { completions: { create } } });

    const result = await service.executeWithGuardrails(
      "org-1",
      "user-1",
      "assistant_chat",
      [{ role: "user", content: "Hello" }],
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-4o-mini" }),
    );
    expect(result.content).toBe("Legacy result");
  });

  it("calls Responses API with stream true and emits text deltas", async () => {
    const create = vi.fn().mockResolvedValue(
      asyncStream([delta("Hello "), delta("world"), completed([], "Hello world")]),
    );
    const onTextDelta = vi.fn();
    const service = makeService({ responses: { create } });

    const result = await service.executeResponsesToolLoopWithGuardrails({
      ...baseOptions,
      onTextDelta,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        stream: true,
        tool_choice: "auto",
        parallel_tool_calls: false,
      }),
    );
    expect(onTextDelta.mock.calls.flat()).toEqual(["Hello ", "world"]);
    expect(result.content).toBe("Hello world");
  });

  it("executes a dynamic tool and submits function_call_output", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(
        asyncStream([
          completed([toolCall("get_sms_usage", "call-1")], "", 7, 2),
        ]),
      )
      .mockResolvedValueOnce(
        asyncStream([delta("Done"), completed([], "Done", 8, 3)]),
      );
    const executeToolCall = vi.fn().mockResolvedValue({ remaining: 10 });
    const service = makeService({ responses: { create } });

    const result = await service.executeResponsesToolLoopWithGuardrails({
      ...baseOptions,
      executeToolCall,
    });

    expect(executeToolCall).toHaveBeenCalledWith({
      name: "get_sms_usage",
      argumentsJson: "{}",
      callId: "call-1",
    });
    expect(create.mock.calls[1][0].input).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "function_call_output",
          call_id: "call-1",
          output: JSON.stringify({ remaining: 10 }),
        }),
      ]),
    );
    expect(result.executedTools).toEqual([
      { name: "get_sms_usage", callId: "call-1", round: 1 },
    ]);
  });

  it("supports multiple sequential tool rounds", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(
        asyncStream([completed([toolCall("get_sms_usage", "call-1")], "")]),
      )
      .mockResolvedValueOnce(
        asyncStream([completed([toolCall("get_sms_usage", "call-2")], "")]),
      )
      .mockResolvedValueOnce(asyncStream([completed([], "Final")]));
    const service = makeService({ responses: { create } });

    await service.executeResponsesToolLoopWithGuardrails({
      ...baseOptions,
      executeToolCall: vi.fn().mockResolvedValue({ ok: true }),
    });

    expect(create).toHaveBeenCalledTimes(3);
  });

  it("rejects more than the maximum tool rounds", async () => {
    const create = vi.fn();
    for (let round = 0; round <= MAX_ASSISTANT_TOOL_ROUNDS; round += 1) {
      create.mockResolvedValueOnce(
        asyncStream([
          completed([toolCall("get_sms_usage", `call-${round}`)], ""),
        ]),
      );
    }
    const service = makeService({ responses: { create } });

    await expect(
      service.executeResponsesToolLoopWithGuardrails({
        ...baseOptions,
        executeToolCall: vi.fn().mockResolvedValue({ ok: true }),
      }),
    ).rejects.toThrow("ASSISTANT_TOOL_ROUND_LIMIT_EXCEEDED");
  });

  it("rejects more than the maximum total tool calls", async () => {
    const calls = Array.from(
      { length: MAX_ASSISTANT_TOOL_CALLS + 1 },
      (_, index) => toolCall("get_sms_usage", `call-${index}`),
    );
    const create = vi.fn().mockResolvedValue(asyncStream([completed(calls, "")]));
    const executeToolCall = vi.fn();
    const service = makeService({ responses: { create } });

    await expect(
      service.executeResponsesToolLoopWithGuardrails({
        ...baseOptions,
        executeToolCall,
      }),
    ).rejects.toThrow("ASSISTANT_TOOL_CALL_LIMIT_EXCEEDED");
    expect(executeToolCall).not.toHaveBeenCalled();
  });

  it("records aggregate usage exactly once across model rounds", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(
        asyncStream([
          completed([toolCall("get_sms_usage", "call-1")], "", 11, 3),
        ]),
      )
      .mockResolvedValueOnce(
        asyncStream([completed([], "Final", 13, 5)]),
      );
    const service = makeService({ responses: { create } });

    const result = await service.executeResponsesToolLoopWithGuardrails({
      ...baseOptions,
      executeToolCall: vi.fn().mockResolvedValue({ ok: true }),
    });

    expect(result).toEqual(
      expect.objectContaining({
        promptTokens: 24,
        completionTokens: 8,
        totalTokens: 32,
      }),
    );
    expect(usage.recordUsage).toHaveBeenCalledTimes(1);
    expect(usage.recordUsage).toHaveBeenCalledWith(
      "org-1",
      "user-1",
      "biz-1",
      "assistant_chat",
      "gpt-4o-mini",
      24,
      8,
      32,
    );
    expect(aiService.checkAndExecute).toHaveBeenCalledTimes(1);
  });

  it("preserves the safe unavailable error", async () => {
    const service = new AiExecutionService(
      aiService as never,
      usage as never,
      policy as never,
      planCapacity as never,
    );
    (service as unknown as { openai: null }).openai = null;

    await expect(
      service.executeResponsesToolLoopWithGuardrails(baseOptions),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("converts raw stream failures to a safe provider error", async () => {
    const create = vi.fn().mockRejectedValue(new Error("secret provider body"));
    const service = makeService({ responses: { create } });

    await expect(
      service.executeResponsesToolLoopWithGuardrails(baseOptions),
    ).rejects.toThrow("AI_PROVIDER_STREAM_FAILED");
    await expect(
      service.executeResponsesToolLoopWithGuardrails(baseOptions),
    ).rejects.not.toThrow("secret provider body");
  });

  it("does not execute tool calls absent from the supplied allowlist", async () => {
    const create = vi.fn().mockResolvedValue(
      asyncStream([completed([toolCall("delete_customer", "call-1")], "")]),
    );
    const executeToolCall = vi.fn();
    const service = makeService({ responses: { create } });

    await expect(
      service.executeResponsesToolLoopWithGuardrails({
        ...baseOptions,
        executeToolCall,
      }),
    ).rejects.toThrow("UNSUPPORTED_ASSISTANT_TOOL");
    expect(executeToolCall).not.toHaveBeenCalled();
  });
});
