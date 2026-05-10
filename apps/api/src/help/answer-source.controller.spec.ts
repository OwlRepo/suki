import { describe, it, expect, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { AnswerSourceController } from "./answer-source.controller";

describe("AnswerSourceController", () => {
  it("throws when organization is missing", async () => {
    const service = {
      getBusinessSummary: vi.fn(),
    };
    const controller = new AnswerSourceController(service as never);

    await expect(controller.getBusinessSummary("biz-1", "2026", "5", undefined)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
