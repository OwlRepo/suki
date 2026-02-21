import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessagingService } from "./messaging.service";
import { AiExecutionService } from "../ai/ai-execution.service";

describe("MessagingService", () => {
  let service: MessagingService;

  beforeEach(() => {
    const mockAiExecution = {
      hasOpenAi: () => false,
    } as unknown as AiExecutionService;
    service = new MessagingService(mockAiExecution);
  });

  it("reports hasOpenAi false when key is missing", () => {
    expect(service.hasOpenAi()).toBe(false);
  });
});
