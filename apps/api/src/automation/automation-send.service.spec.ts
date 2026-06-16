import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@tyvera/database";
import { AutomationMessageComposerService } from "./automation-message-composer.service";
import { AutomationSendService } from "./automation-send.service";
import { AutomationSettingsService } from "./automation-settings.service";

vi.mock("@tyvera/database", async () => {
  const actual = await vi.importActual<typeof import("@tyvera/database")>(
    "@tyvera/database",
  );
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

function installDbHarness(selectResults: unknown[][]) {
  const limit = vi.fn(async () => selectResults.shift() ?? []);
  const select = vi.fn(() => ({
    from: () => ({
      where: () => ({ limit }),
    }),
  }));
  const set = vi.fn(() => ({ where: vi.fn(async () => undefined) }));
  const update = vi.fn(() => ({ set }));
  vi.mocked(getDb).mockReturnValue({ select, update } as never);
  return { set };
}

describe("AutomationSendService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses saved appointment confirmation template and renders businessName before dispatch", async () => {
    installDbHarness([
      [
        {
          id: "appointment-1",
          businessId: "business-1",
          customerId: "customer-1",
          scheduledAt: new Date("2026-06-17T02:30:00.000Z"),
          staffName: null,
          confirmationSentAt: null,
        },
      ],
      [
        {
          id: "customer-1",
          name: "Romeo Angeles",
        },
      ],
      [{ name: "Yanna Spa" }],
    ]);
    const dispatch = {
      dispatch: vi.fn(async () => ({ status: "sent" })),
    };
    const settings = new AutomationSettingsService();
    vi.spyOn(settings, "getOrCreate").mockResolvedValue({
      id: "settings-row-1",
      businessId: "business-1",
      appointmentRemindersEnabled: true,
      appointmentReminder72hEnabled: false,
      missedRecoveryEnabled: true,
      postVisitFollowUpEnabled: true,
      inactivityWinbackEnabled: true,
      loyaltyUnlockEnabled: true,
      inactivityDays: 60,
      autoSendChannel: "sms",
      messageTemplates: {
        appointment_confirmation: {
          sms:
            "Hi {customerName}! Your appointment at {businessName} is confirmed for {dateTime}.",
        },
      },
    });
    const service = new AutomationSendService(
      dispatch as never,
      settings,
      new AutomationMessageComposerService(),
      { autoMessagingEnabled: () => true } as never,
    );

    await expect(
      service.sendAppointmentConfirmation(
        "org-1",
        "business-1",
        "appointment-1",
      ),
    ).resolves.toEqual({ status: "sent", reason: undefined });

    expect(dispatch.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: "business-1",
        automationKey: "appointment_confirmation",
        rawMessage: expect.stringContaining(
          "Hi Romeo Angeles! Your appointment at Yanna Spa is confirmed",
        ),
      }),
    );
    expect(dispatch.dispatch).toHaveBeenCalledWith(
      expect.not.objectContaining({
        rawMessage: expect.stringContaining("Your appointment is confirmed"),
      }),
    );
  });
});
