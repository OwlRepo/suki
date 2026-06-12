import { beforeEach, describe, expect, it, vi } from "vitest";
import { automationSettings, getDb } from "@tyvera/database";
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

const storedRow = {
  id: "settings-1",
  businessId: "business-1",
  appointmentRemindersEnabled: "true",
  appointmentReminder72hEnabled: "false",
  missedRecoveryEnabled: "true",
  postVisitFollowUpEnabled: "true",
  inactivityWinbackEnabled: "false",
  loyaltyUnlockEnabled: "true",
  inactivityDays: 45,
  autoSendChannel: "sms",
  messageTemplates: {},
};

function createDbHarness(settingsRows: unknown[][]) {
  const insert = vi.fn((table: unknown) => ({
    values: (value: Record<string, unknown>) => ({
      returning: async () => [{ id: "created-settings", ...value }],
    }),
  }));
  const limit = vi.fn(async () => settingsRows.shift() ?? []);
  const select = vi.fn(() => ({
    from: () => ({
      where: () => ({ limit }),
    }),
  }));
  vi.mocked(getDb).mockReturnValue({ select, insert } as never);
  return { insert };
}

describe("AutomationSettingsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a stored snapshot without inserting", async () => {
    const db = createDbHarness([[{ id: "business-1" }], [storedRow]]);
    const service = new AutomationSettingsService();

    await expect(service.getSnapshot("business-1", "org-1")).resolves.toEqual(
      expect.objectContaining({
        id: "settings-1",
        businessId: "business-1",
        inactivityWinbackEnabled: false,
        inactivityDays: 45,
      }),
    );
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("returns in-memory defaults when no row exists and never inserts", async () => {
    const db = createDbHarness([[{ id: "business-1" }], []]);
    const service = new AutomationSettingsService();

    await expect(service.getSnapshot("business-1", "org-1")).resolves.toEqual(
      expect.objectContaining({
        businessId: "business-1",
        appointmentRemindersEnabled: true,
        inactivityWinbackEnabled: true,
        inactivityDays: 60,
        autoSendChannel: "sms",
      }),
    );
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("preserves getOrCreate insert behavior", async () => {
    const db = createDbHarness([[{ id: "business-1" }], []]);
    const service = new AutomationSettingsService();

    await service.getOrCreate("business-1", "org-1");

    expect(db.insert).toHaveBeenCalledWith(automationSettings);
  });
});
