import { describe, it, expect, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { AssistantController } from "./assistant.controller";

describe("AssistantController", () => {
  it("throws when org or user is missing", async () => {
    const service = { chat: vi.fn() };
    const controller = new AssistantController(service as never);
    await expect(controller.chat({ message: "hi" }, undefined, "user-1")).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.chat({ message: "hi" }, "org-1", undefined)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("writes SSE frames incrementally through the emitter callback", async () => {
    const writes: string[] = [];
    const service = {
      chatStreamToEmitter: vi.fn(async (_input, emit) => {
        await emit({ type: "delta", chunk: "First" });
        expect(writes.join("")).toContain("First");
        await emit({ type: "done", response: { plainAnswer: "First", nextStep: "Done" } });
      }),
    };
    const response = {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn((value: string) => {
        writes.push(value);
      }),
      end: vi.fn(),
    };
    const controller = new AssistantController(service as never);

    await controller.chatStream(
      { message: "hi", businessId: "biz-1" },
      response as never,
      "org-1",
      "user-1",
    );

    expect(writes.join("")).toContain(
      'event: delta\ndata: {"type":"delta","chunk":"First"}\n\n',
    );
    expect(response.flushHeaders).toHaveBeenCalledOnce();
    expect(response.end).toHaveBeenCalledOnce();
  });

  it("emits a safe terminal error and ends once when streaming fails", async () => {
    const service = {
      chatStreamToEmitter: vi.fn(async () => {
        throw new Error("raw provider secret");
      }),
    };
    const response = {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    };
    const controller = new AssistantController(service as never);

    await controller.chatStream(
      { message: "hi" },
      response as never,
      "org-1",
      "user-1",
    );

    const output = response.write.mock.calls.flat().join("");
    expect(output).toContain("ASSISTANT_STREAM_FAILED");
    expect(output).not.toContain("raw provider secret");
    expect(response.end).toHaveBeenCalledOnce();
  });

  it("confirms a pending mutation through authenticated server context", async () => {
    const service = {
      confirmMutation: vi.fn().mockResolvedValue({
        status: "ok",
        action: "update_customer",
      }),
    };
    const controller = new AssistantController(service as never);

    await controller.confirmMutation(
      { token: "signed.token", businessId: "biz-1" },
      "org-1",
      "user-1",
    );

    expect(service.confirmMutation).toHaveBeenCalledWith({
      token: "signed.token",
      businessId: "biz-1",
      organizationId: "org-1",
      userId: "user-1",
    });
  });
});
