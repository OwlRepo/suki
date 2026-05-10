import { BadRequestException, ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessagingService } from "./messaging.service";
import { AiExecutionService } from "../ai/ai-execution.service";

const limitMock = vi.fn();
const whereMock = vi.fn();
const fromMock = vi.fn();
const selectMock = vi.fn();

vi.mock("@suki/database", () => ({
  getDb: () => ({ select: selectMock, from: fromMock, where: whereMock }),
  businesses: { id: "id", organizationId: "organizationId" },
  aiCredits: { organizationId: "organizationId", month: "month" },
}));

describe("MessagingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectMock.mockReturnValue({ from: fromMock });
    fromMock.mockReturnValue({ where: whereMock });
    whereMock.mockReturnValue({ limit: limitMock });
  });

  it("reports hasOpenAi", () => {
    const service = new MessagingService({ hasOpenAi: () => false } as unknown as AiExecutionService);
    expect(service.hasOpenAi()).toBe(false);
  });

  it("throws when OpenAI is not configured", async () => {
    const service = new MessagingService({ hasOpenAi: () => false } as unknown as AiExecutionService);
    await expect(service.generate("org", "user", "biz", "hello")).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it("throws when prompt is blank", async () => {
    const service = new MessagingService({ hasOpenAi: () => true } as unknown as AiExecutionService);
    await expect(service.generate("org", "user", "biz", "   ")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("throws forbidden when business is not owned by org", async () => {
    limitMock.mockResolvedValueOnce([]);
    const service = new MessagingService({ hasOpenAi: () => true } as unknown as AiExecutionService);
    await expect(service.generate("org", "user", "biz", "hello")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
