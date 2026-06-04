import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ManualFollowUpController } from "./manual-follow-up.controller";

describe("ManualFollowUpController", () => {
  function makeController() {
    const manualFollowUps = {
      list: vi.fn(async () => []),
      countOpen: vi.fn(async () => ({ count: 2 })),
      resolve: vi.fn(async () => ({ id: "task-1" })),
    };
    const retryService = {
      retryAutomaticSms: vi.fn(async () => ({ status: "sent" })),
    };
    return {
      controller: new ManualFollowUpController(
        manualFollowUps as never,
        retryService as never,
      ),
      manualFollowUps,
      retryService,
    };
  }

  it("requires tenant context", async () => {
    const { controller } = makeController();
    await expect(controller.list(undefined, "open")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(controller.openCount(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("validates resolve status and never accepts organization id from body", async () => {
    const { controller, manualFollowUps } = makeController();
    await expect(
      controller.resolve("task-1", { status: "open" }, "org-1", "user-1"),
    ).rejects.toBeInstanceOf(BadRequestException);

    await controller.resolve(
      "task-1",
      { status: "contacted" },
      "org-1",
      "user-1",
    );
    expect(manualFollowUps.resolve).toHaveBeenCalledWith({
      organizationId: "org-1",
      userId: "user-1",
      taskId: "task-1",
      status: "contacted",
    });
  });

  it("routes automatic retry through retry service", async () => {
    const { controller, retryService } = makeController();
    await expect(controller.retrySms("task-1", "org-1", "user-1")).resolves.toEqual({
      status: "sent",
    });
    expect(retryService.retryAutomaticSms).toHaveBeenCalledWith({
      organizationId: "org-1",
      userId: "user-1",
      taskId: "task-1",
    });
  });
});
