import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@tyvera/database";
import { AutomationSchedulerService } from "./automation-scheduler.service";
import type { AutomationSendService } from "./automation-send.service";
import type { FeatureFlagsService } from "../common/feature-flags.service";
import type { AutomationJobRunService } from "../operations/automation-job-run.service";

vi.mock("@tyvera/database", async () => {
  const actual = await vi.importActual<typeof import("@tyvera/database")>(
    "@tyvera/database",
  );
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

function makeDbForAppointmentReminders() {
  const datasets = [
    [
      {
        id: "appointment-24h",
        organizationId: "org-1",
        businessId: "business-1",
      },
    ],
    [
      {
        id: "appointment-72h",
        organizationId: "org-1",
        businessId: "business-1",
      },
    ],
  ];
  const where = vi.fn(async () => datasets.shift() ?? []);
  vi.mocked(getDb).mockReturnValue({
    select: vi.fn(() => ({
      from: () => ({
        innerJoin: () => ({ where }),
      }),
    })),
  } as never);
}

function makeDbForInactivityWinback() {
  const where = vi
    .fn()
    .mockResolvedValueOnce([
      {
        organizationId: "org-1",
        businessId: "business-1",
        inactivityDays: 60,
        enabled: "true",
      },
    ])
    .mockReturnValueOnce({
      limit: async () => [{ id: "customer-1" }, { id: "customer-2" }],
    });
  vi.mocked(getDb).mockReturnValue({
    select: vi.fn(() => ({
      from: () => ({
        innerJoin: () => ({ where }),
        where,
      }),
    })),
  } as never);
}

function createService(input: {
  send?: Partial<AutomationSendService>;
  record?: ReturnType<typeof vi.fn>;
}) {
  const automationSend = {
    sendAppointmentReminder24h: vi.fn(async () => undefined),
    sendAppointmentReminder72h: vi.fn(async () => undefined),
    sendInactivityWinback: vi.fn(async () => undefined),
    ...input.send,
  };
  const featureFlags = {
    autoFollowupsSchedulerEnabled: vi.fn(() => true),
  } as unknown as FeatureFlagsService;
  const jobRuns = {
    record: input.record ?? vi.fn(async (_jobKey, work) => (await work()).result),
  } as unknown as AutomationJobRunService;

  return {
    service: new AutomationSchedulerService(
      automationSend as unknown as AutomationSendService,
      featureFlags,
      jobRuns,
    ),
    automationSend,
    jobRuns,
  };
}

describe("AutomationSchedulerService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("awaits appointment reminder sends with Promise.allSettled and stores deterministic counts", async () => {
    makeDbForAppointmentReminders();
    const record = vi.fn(async (_jobKey: string, work: () => Promise<unknown>) => work());
    const { service, automationSend } = createService({
      record,
      send: {
        sendAppointmentReminder72h: vi.fn(async () => {
          throw new Error("provider down");
        }),
      },
    });

    await service.runAppointmentReminders();

    expect(record).toHaveBeenCalledWith("appointment_reminders", expect.any(Function));
    expect(automationSend.sendAppointmentReminder24h).toHaveBeenCalledWith(
      "org-1",
      "business-1",
      "appointment-24h",
    );
    expect(automationSend.sendAppointmentReminder72h).toHaveBeenCalledWith(
      "org-1",
      "business-1",
      "appointment-72h",
    );
    await expect(record.mock.results[0].value).resolves.toMatchObject({
      processedCount: 2,
      successCount: 1,
      failureCount: 1,
    });
  });

  it("stores deterministic inactivity winback counts", async () => {
    makeDbForInactivityWinback();
    const record = vi.fn(async (_jobKey: string, work: () => Promise<unknown>) => work());
    const { service, automationSend } = createService({ record });

    await service.runInactivityWinback();

    expect(record).toHaveBeenCalledWith("inactivity_winback", expect.any(Function));
    expect(automationSend.sendInactivityWinback).toHaveBeenCalledTimes(2);
    await expect(record.mock.results[0].value).resolves.toMatchObject({
      processedCount: 2,
      successCount: 2,
      failureCount: 0,
    });
  });
});
