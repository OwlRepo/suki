import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@tyvera/database";
import { PgDialect } from "drizzle-orm/pg-core";
import { MANUAL_FOLLOW_UP_AUTOMATION_KEYS } from "./manual-follow-ups/manual-follow-up.constants";
import {
  SemaphoreMessageReconciliationService,
  extractSemaphoreMessageId,
  getAutomationSentMarkerTarget,
  stripKnownAutomationFooter,
} from "./semaphore-message-reconciliation.service";

vi.mock("@tyvera/database", async () => {
  const actual = await vi.importActual<typeof import("@tyvera/database")>(
    "@tyvera/database",
  );
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

function makeService() {
  const manualFollowUps = {
    createFromMessageEvent: vi.fn(async () => ({})),
  };
  const jobRuns = {
    record: vi.fn(async (_jobKey: string, work: () => Promise<unknown>) => work()),
  };
  return {
    service: new SemaphoreMessageReconciliationService(
      manualFollowUps as never,
      jobRuns as never,
    ),
    manualFollowUps,
    jobRuns,
  };
}

describe("SemaphoreMessageReconciliationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SEMAPHORE_API_KEY;
    delete process.env.SEMAPHORE_RECONCILIATION_ENABLED;
  });

  it.each([
    ["queued", "queued"],
    ["pending", "queued"],
    ["sent", "sent"],
    ["failed", "failed"],
    ["refunded", "failed"],
  ])("maps Semaphore %s to %s", (raw, expected) => {
    expect(makeService().service.mapSemaphoreStatus(raw)).toBe(expected);
  });

  it("extracts string and numeric Semaphore message IDs from provider metadata", () => {
    expect(extractSemaphoreMessageId({ message_id: "12345" })).toBe("12345");
    expect(extractSemaphoreMessageId({ message_id: 12345 })).toBe("12345");
    expect(extractSemaphoreMessageId({ message_id: null })).toBeNull();
  });

  it.each([
    ["appointment_confirmation", "appointments", "confirmation_sent_at"],
    ["appointment_reminder_24h", "appointments", "reminder_24h_sent_at"],
    ["appointment_reminder_72h", "appointments", "reminder_72h_sent_at"],
    ["missed_recovery", "appointments", "missed_recovery_sent_at"],
    ["post_visit_followup", "customers", "post_visit_followup_sent_at"],
    ["inactivity_winback", "customers", "inactivity_winback_sent_at"],
    ["loyalty_unlock", "customers", "loyalty_unlock_sent_at"],
  ])("maps %s to its sent marker", (automationKey, table, column) => {
    expect(getAutomationSentMarkerTarget(automationKey)).toMatchObject({
      table,
      column,
    });
  });

  it("strips only the known automation footer", () => {
    expect(stripKnownAutomationFooter("Hello Sent automatically by Tyvera")).toBe(
      "Hello",
    );
    expect(stripKnownAutomationFooter("Hello")).toBe("Hello");
  });

  it("builds reconciliation query with a valid parameterized automation key filter", async () => {
    process.env.SEMAPHORE_API_KEY = "key";
    const execute = vi.fn().mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue({ execute } as never);

    await expect(makeService().service.reconcileRecentMessages()).resolves.toEqual({
      checked: 0,
      failed: 0,
      repaired: 0,
    });

    const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0] as never);
    expect(query.sql).toContain("me.automation_key in (");
    expect(query.sql).not.toContain("any(($");
    expect(query.sql).not.toContain("::text[]");
    expect(query.sql).not.toContain("provider_metadata ?");
    expect(query.sql).toContain("jsonb_exists");
    expect(query.params).toEqual(
      expect.arrayContaining([...MANUAL_FOLLOW_UP_AUTOMATION_KEYS]),
    );
  });

  it("repairs an accepted false rejection atomically", async () => {
    process.env.SEMAPHORE_API_KEY = "key";
    const execute = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "event-1",
          businessId: "business-1",
          organizationId: "org-1",
          content: "Confirmation Sent automatically by Tyvera",
          providerMessageId: null,
          providerMetadata: {
            message_id: 12345,
            estimatedSegments: 2,
          },
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          repaired: "event-1",
          automationKey: "appointment_confirmation",
          appointmentId: "appointment-1",
          customerId: "customer-1",
          createdAt: new Date("2026-06-16T00:36:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue({
      execute,
      transaction: async (work: (tx: { execute: typeof execute }) => unknown) =>
        work({ execute }),
    } as never);

    const { service, manualFollowUps } = makeService();
    vi.spyOn(service, "fetchSemaphoreStatus").mockResolvedValue("sent");

    await expect(service.reconcileRecentMessages()).resolves.toEqual({
      checked: 1,
      failed: 0,
      repaired: 1,
    });
    expect(service.fetchSemaphoreStatus).toHaveBeenCalledWith("key", "12345");
    expect(execute).toHaveBeenCalledTimes(4);
    expect(manualFollowUps.createFromMessageEvent).not.toHaveBeenCalled();
  });

  it("does not double-repair when atomic repair loses the concurrency race", async () => {
    process.env.SEMAPHORE_API_KEY = "key";
    const execute = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "event-1",
          businessId: "business-1",
          organizationId: "org-1",
          content: "Confirmation",
          providerMessageId: null,
          providerMetadata: { message_id: 12345, estimatedSegments: 1 },
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    vi.mocked(getDb).mockReturnValue({
      execute,
      transaction: async (work: (tx: { execute: typeof execute }) => unknown) =>
        work({ execute }),
    } as never);

    const { service } = makeService();
    vi.spyOn(service, "fetchSemaphoreStatus").mockResolvedValue("sent");

    await expect(service.reconcileRecentMessages()).resolves.toEqual({
      checked: 1,
      failed: 0,
      repaired: 0,
    });
  });

  it.each([
    ["failed", "semaphore_failed"],
    ["refunded", "semaphore_refunded"],
  ])("preserves real %s failures with precise reason", async (status, reason) => {
    process.env.SEMAPHORE_API_KEY = "key";
    const execute = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "event-1",
          businessId: "business-1",
          organizationId: "org-1",
          content: "Confirmation Sent automatically by Tyvera",
          providerMessageId: null,
          providerMetadata: { message_id: 12345 },
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ failed: true }]);
    vi.mocked(getDb).mockReturnValue({
      execute,
      transaction: async (work: (tx: { execute: typeof execute }) => unknown) =>
        work({ execute }),
    } as never);

    const { service, manualFollowUps } = makeService();
    vi.spyOn(service, "fetchSemaphoreStatus").mockResolvedValue(status);

    await expect(service.reconcileRecentMessages()).resolves.toEqual({
      checked: 1,
      failed: 1,
      repaired: 0,
    });
    expect(manualFollowUps.createFromMessageEvent).toHaveBeenCalledWith({
      organizationId: "org-1",
      businessId: "business-1",
      originalMessageEventId: "event-1",
      manualRetryRawMessage: "Confirmation",
      fallbackFailureReason: reason,
    });
  });

  it("leaves unknown provider statuses unresolved", async () => {
    process.env.SEMAPHORE_API_KEY = "key";
    const execute = vi.fn().mockResolvedValueOnce([
      {
        id: "event-1",
        businessId: "business-1",
        organizationId: "org-1",
        content: "Confirmation",
        providerMessageId: null,
        providerMetadata: { message_id: 12345 },
      },
    ]);
    vi.mocked(getDb).mockReturnValue({ execute } as never);

    const { service } = makeService();
    vi.spyOn(service, "fetchSemaphoreStatus").mockResolvedValue(null);

    await expect(service.reconcileRecentMessages()).resolves.toEqual({
      checked: 1,
      failed: 0,
      repaired: 0,
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("wraps scheduled reconciliation in a deterministic automation job run", async () => {
    process.env.SEMAPHORE_RECONCILIATION_ENABLED = "true";
    const { service, jobRuns } = makeService();
    vi.spyOn(service, "reconcileRecentMessages").mockResolvedValue({
      checked: 4,
      failed: 1,
      repaired: 2,
    });

    await service.runScheduledReconciliation();

    expect(jobRuns.record).toHaveBeenCalledWith(
      "semaphore_reconciliation",
      expect.any(Function),
    );
    await expect(jobRuns.record.mock.results[0].value).resolves.toMatchObject({
      processedCount: 4,
      successCount: 3,
      failureCount: 1,
      result: { repaired: 2 },
    });
  });
});
