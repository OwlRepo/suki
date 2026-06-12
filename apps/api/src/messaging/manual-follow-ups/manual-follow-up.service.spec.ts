import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@tyvera/database";
import { MANUAL_FOLLOW_UP_AUTOMATION_KEY_SET } from "./manual-follow-up.constants";
import { ManualFollowUpService } from "./manual-follow-up.service";

vi.mock("@tyvera/database", async () => {
  const actual = await vi.importActual<typeof import("@tyvera/database")>(
    "@tyvera/database",
  );
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

describe("ManualFollowUpService constants", () => {
  it("supports only appointment-related urgent SMS keys", () => {
    expect(MANUAL_FOLLOW_UP_AUTOMATION_KEY_SET.has("appointment_confirmation")).toBe(true);
    expect(MANUAL_FOLLOW_UP_AUTOMATION_KEY_SET.has("appointment_reminder_24h")).toBe(true);
    expect(MANUAL_FOLLOW_UP_AUTOMATION_KEY_SET.has("post_visit_followup")).toBe(false);
    expect(MANUAL_FOLLOW_UP_AUTOMATION_KEY_SET.has("loyalty_unlock")).toBe(false);
  });
});

describe("ManualFollowUpService aggregate reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an open aggregate without recipient or message PII", async () => {
    const select = vi.fn((selection: Record<string, unknown>) => ({
      from: () => ({
        where: () => ({
          groupBy: async () => [
            {
              reason: "provider_rejected",
              count: 2,
              duplicateRisk: 0,
            },
            {
              reason: "provider_outcome_unknown",
              count: 1,
              duplicateRisk: 1,
            },
          ],
        }),
      }),
    }));
    vi.mocked(getDb).mockReturnValue({ select } as never);

    const result = await new ManualFollowUpService().getOpenSummary("org-1");

    expect(result).toEqual({
      open: 3,
      duplicateRisk: 1,
      byFailureReason: [
        { reason: "provider_rejected", count: 2 },
        { reason: "provider_outcome_unknown", count: 1 },
      ],
    });
    expect(Object.keys(select.mock.calls[0][0])).toEqual([
      "reason",
      "count",
      "duplicateRisk",
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /recipientMobile|messageBody|manualRetryRawMessage|customerName/,
    );
  });
});
