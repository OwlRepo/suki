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
});
