import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AutomationController } from "./automation.controller";

describe("AutomationController", () => {
  const settings = {
    update: vi.fn(),
    getOrCreate: vi.fn(),
    getPreviews: vi.fn(),
  };
  const messaging = {
    generate: vi.fn(),
  };

  let controller: AutomationController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AutomationController(settings as never, messaging as never);
  });

  it("passes template updates to settings service", async () => {
    settings.update.mockResolvedValue({ ok: true });
    await controller.updateSettings(
      {
        businessId: "b1",
        messageTemplates: {
          post_visit_followup: {
            sms: "Hi {customerName}",
          },
        },
      },
      "org1",
    );

    expect(settings.update).toHaveBeenCalledWith(
      "b1",
      "org1",
      expect.objectContaining({
        messageTemplates: {
          post_visit_followup: {
            sms: "Hi {customerName}",
          },
        },
      }),
    );
  });

  it("refines message via messaging.generate", async () => {
    messaging.generate.mockResolvedValue({ generatedMessage: "Refined", creditsUsed: 1 });

    await expect(
      controller.refineMessage(
        {
          businessId: "b1",
          automationKey: "post_visit_followup",
          channel: "sms",
          draft: "old",
        },
        "org1",
        "user1",
      ),
    ).resolves.toEqual({ refinedMessage: "Refined", creditsUsed: 1 });
  });

  it("rejects refine without required body", async () => {
    await expect(
      controller.refineMessage(
        {
          businessId: "",
          automationKey: "post_visit_followup",
          channel: "sms",
          draft: "",
        },
        "org1",
        "user1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects refine without tenant", async () => {
    await expect(
      controller.refineMessage(
        {
          businessId: "b1",
          automationKey: "post_visit_followup",
          channel: "sms",
          draft: "old",
        },
        undefined,
        "user1",
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
