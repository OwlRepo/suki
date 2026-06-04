import { beforeEach, describe, expect, it, vi } from "vitest";
import { ManualFollowUpDigestService } from "./manual-follow-up-digest.service";

const db = {
  select: vi.fn(),
};

vi.mock("@tyvera/database", () => ({
  getDb: () => db,
  manualFollowUpTasks: {
    organizationId: "organizationId",
    status: "status",
    notifiedAt: "notifiedAt",
  },
  users: { id: "id", organizationId: "organizationId", role: "role" },
  authIdentities: { userId: "userId", email: "email" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ a, b })),
  and: vi.fn((...args) => args),
  isNull: vi.fn((a) => ({ isNull: a })),
  sql: vi.fn(() => "sql"),
}));

describe("ManualFollowUpDigestService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FRONTEND_URL = "https://app.tyvera.test";
  });

  it("marks notified only after successful owner email", async () => {
    const manualFollowUps = {
      list: vi.fn(async () => [
        { id: "task-1", notifiedAt: null },
        { id: "task-2", notifiedAt: new Date() },
      ]),
      markNotified: vi.fn(async () => undefined),
    };
    const emailProvider = { send: vi.fn(async () => ({ ok: true })) };
    db.select.mockReturnValue({
      from: () => ({
        innerJoin: () => ({
          where: async () => [{ email: "owner@example.com" }],
        }),
      }),
    });
    const service = new ManualFollowUpDigestService(
      manualFollowUps as never,
      emailProvider as never,
    );

    await expect(service.sendOrganizationDigest("org-1", 2)).resolves.toEqual({
      sent: 1,
    });
    expect(emailProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@example.com",
        body: expect.not.stringContaining("+639"),
      }),
    );
    expect(manualFollowUps.markNotified).toHaveBeenCalledWith("org-1", [
      "task-1",
    ]);
  });

  it("does not mark notified when no email succeeds", async () => {
    const manualFollowUps = {
      list: vi.fn(),
      markNotified: vi.fn(),
    };
    const emailProvider = { send: vi.fn(async () => ({ ok: false })) };
    db.select.mockReturnValue({
      from: () => ({
        innerJoin: () => ({
          where: async () => [{ email: "owner@example.com" }],
        }),
      }),
    });
    const service = new ManualFollowUpDigestService(
      manualFollowUps as never,
      emailProvider as never,
    );

    await service.sendOrganizationDigest("org-1", 1);

    expect(manualFollowUps.markNotified).not.toHaveBeenCalled();
  });
});
