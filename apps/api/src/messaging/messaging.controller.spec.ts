import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { MessagingController } from "./messaging.controller";

describe("MessagingController", () => {
  function makeController() {
    const messagingService = {
      getCredits: vi.fn(async () => ({ allocated: 100, used: 0, remaining: 100, month: "2026-05" })),
      generate: vi.fn(async () => ({ generatedMessage: "hello", creditsUsed: 1 })),
    };
    const planCapacity = {} as never;
    const smsMetering = { getOrCreateCredits: vi.fn(async () => ({ used: 1 })) };
    const emailMetering = { getOrCreateCredits: vi.fn(async () => ({ used: 2 })) };
    return {
      controller: new MessagingController(
        messagingService as never,
        planCapacity,
        smsMetering as never,
        emailMetering as never,
      ),
      messagingService,
      smsMetering,
      emailMetering,
    };
  }

  it("throws unauthorized when org is missing", async () => {
    const { controller } = makeController();
    await expect(controller.getCredits(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.getSmsUsage(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.getEmailUsage(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("throws unauthorized when user is missing on generate", async () => {
    const { controller } = makeController();
    await expect(
      controller.generate({ businessId: "biz", prompt: "x" }, "org", undefined),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("validates businessId and prompt", async () => {
    const { controller } = makeController();
    await expect(
      controller.generate({ businessId: "", prompt: "" }, "org", "user"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("forwards generate and usage calls", async () => {
    const { controller, messagingService, smsMetering, emailMetering } = makeController();

    await expect(controller.getCredits("org")).resolves.toEqual({ allocated: 100, used: 0, remaining: 100, month: "2026-05" });
    await expect(controller.getSmsUsage("org")).resolves.toEqual({ used: 1 });
    await expect(controller.getEmailUsage("org")).resolves.toEqual({ used: 2 });
    await expect(
      controller.generate({ businessId: "biz", prompt: "  hello  ", context: { k: 1 } }, "org", "user"),
    ).resolves.toEqual({ generatedMessage: "hello", creditsUsed: 1 });

    expect(messagingService.generate).toHaveBeenCalledWith("org", "user", "biz", "hello", { k: 1 });
    expect(smsMetering.getOrCreateCredits).toHaveBeenCalledWith("org");
    expect(emailMetering.getOrCreateCredits).toHaveBeenCalledWith("org");
  });
});
