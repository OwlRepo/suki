import { describe, expect, it, vi } from "vitest";
import {
  SemaphoreMessageReconciliationService,
  stripKnownAutomationFooter,
} from "./semaphore-message-reconciliation.service";

describe("SemaphoreMessageReconciliationService", () => {
  it.each([
    ["queued", "queued"],
    ["pending", "queued"],
    ["sent", "sent"],
    ["failed", "failed"],
    ["refunded", "failed"],
  ])("maps Semaphore %s to %s", (raw, expected) => {
    const service = new SemaphoreMessageReconciliationService(
      {} as never,
      { record: vi.fn() } as never,
    );
    expect(service.mapSemaphoreStatus(raw)).toBe(expected);
  });

  it("strips only the known automation footer", () => {
    expect(stripKnownAutomationFooter("Hello Sent automatically by Tyvera")).toBe(
      "Hello",
    );
    expect(stripKnownAutomationFooter("Hello")).toBe("Hello");
  });

  it("creates tasks for failed reconciliation without duplicating logic in the service", async () => {
    const manualFollowUps = { createFromMessageEvent: vi.fn(async () => ({})) };
    const service = new SemaphoreMessageReconciliationService(
      manualFollowUps as never,
      { record: vi.fn() } as never,
    );
    vi.spyOn(service, "fetchSemaphoreStatus").mockResolvedValue("failed");
    process.env.SEMAPHORE_API_KEY = "key";

    const updates: Record<string, unknown>[] = [];
    vi.doMock("@tyvera/database", () => ({}));

    expect(service.mapSemaphoreStatus("failed")).toBe("failed");
    expect(updates).toEqual([]);
  });

  it("wraps scheduled reconciliation in a deterministic automation job run", async () => {
    process.env.SEMAPHORE_RECONCILIATION_ENABLED = "true";
    const jobRuns = {
      record: vi.fn(async (_jobKey: string, work: () => Promise<unknown>) => work()),
    };
    const service = new SemaphoreMessageReconciliationService(
      { createFromMessageEvent: vi.fn() } as never,
      jobRuns as never,
    );
    vi.spyOn(service, "reconcileRecentMessages").mockResolvedValue({
      checked: 4,
      failed: 1,
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
    });
  });
});
