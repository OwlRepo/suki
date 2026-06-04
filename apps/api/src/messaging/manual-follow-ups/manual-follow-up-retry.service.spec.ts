import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ManualFollowUpRetryService } from "./manual-follow-up-retry.service";

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    organizationId: "org-1",
    businessId: "biz-1",
    customerId: "cust-1",
    appointmentId: "appt-1",
    automationKey: "appointment_reminder_24h",
    purpose: "transactional",
    manualRetryRawMessage: "Raw reminder",
    failureReason: "provider_rejected",
    ...overrides,
  };
}

describe("ManualFollowUpRetryService", () => {
  it("blocks automatic retry for unknown outcome", async () => {
    const manualFollowUps = {
      getOpenTask: vi.fn(async () =>
        makeTask({ failureReason: "provider_outcome_unknown" }),
      ),
      attachRetryMessageEvent: vi.fn(),
    };
    const dispatch = { dispatch: vi.fn() };
    const service = new ManualFollowUpRetryService(
      manualFollowUps as never,
      dispatch as never,
    );

    await expect(
      service.retryAutomaticSms({
        organizationId: "org-1",
        userId: "user-1",
        taskId: "task-1",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dispatch.dispatch).not.toHaveBeenCalled();
  });

  it("creates a new dispatch event and links it without mutating the original", async () => {
    const manualFollowUps = {
      getOpenTask: vi.fn(async () => makeTask()),
      attachRetryMessageEvent: vi.fn(async () => undefined),
    };
    const dispatch = {
      dispatch: vi.fn(async () => ({ status: "sent", messageEventId: "evt-new" })),
    };
    const service = new ManualFollowUpRetryService(
      manualFollowUps as never,
      dispatch as never,
    );

    await expect(
      service.retryAutomaticSms({
        organizationId: "org-1",
        userId: "user-1",
        taskId: "task-1",
      }),
    ).resolves.toEqual({ status: "sent" });

    expect(dispatch.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        rawMessage: "Raw reminder",
        channel: "sms",
      }),
    );
    expect(manualFollowUps.attachRetryMessageEvent).toHaveBeenCalledWith(
      expect.objectContaining({ retryMessageEventId: "evt-new" }),
    );
  });
});
