import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@tyvera/database";
import { PlatformAdminCommunicationsService } from "./platform-admin-communications.service";

const executeMock = vi.fn();

vi.mock("@tyvera/database", async () => {
  const actual = await vi.importActual<typeof import("@tyvera/database")>(
    "@tyvera/database",
  );
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

function sqlChunks(value: unknown): string {
  const chunks = (value as { queryChunks?: unknown[] }).queryChunks ?? [];
  return chunks
    .map((chunk) => {
      if (typeof chunk === "string" || typeof chunk === "number") return String(chunk);
      if ((chunk as { queryChunks?: unknown[] }).queryChunks) return sqlChunks(chunk);
      const value = (chunk as { value?: string[] }).value;
      return Array.isArray(value) ? value.join("") : "";
    })
    .join(" ");
}

function sqlBoundValues(value: unknown): unknown[] {
  const chunks = (value as { queryChunks?: unknown[] }).queryChunks ?? [];
  return chunks.flatMap((chunk) => {
    if ((chunk as { queryChunks?: unknown[] }).queryChunks) {
      return sqlBoundValues(chunk);
    }
    if ((chunk as { value?: string[] }).value) return [];
    return [chunk];
  });
}

describe("PlatformAdminCommunicationsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T12:00:00.000Z"));
    vi.mocked(getDb).mockReturnValue({ execute: executeMock } as never);
  });

  it("lists communications with filters, pagination, masked recipients, and no raw content or metadata", async () => {
    executeMock
      .mockResolvedValueOnce([{ total: 3 }])
      .mockResolvedValueOnce([
        {
          id: "message-1",
          organizationId: "org-1",
          organizationName: "Tyvera Clinic",
          businessId: "business-1",
          businessName: "Main Branch",
          appointmentId: null,
          customerId: "customer-1",
          customerName: "Romeo Angeles",
          recipientRaw: "+639171234567",
          channel: "sms",
          automationKey: "appointment_reminder_24h",
          purpose: "transactional",
          status: "sent",
          deliveryStatus: "failed",
          provider: "semaphore",
          retryCount: 1,
          unitsConsumed: 2,
          failureReason: "semaphore_failed",
          sentAt: new Date("2026-06-07T10:00:00.000Z"),
          createdAt: new Date("2026-06-07T09:59:00.000Z"),
          content: "do not expose",
          providerMetadata: { secret: "do not expose" },
        },
      ]);

    const service = new PlatformAdminCommunicationsService();
    const result = await service.listCommunications({
      channel: "sms",
      deliveryStatus: "failed",
      organizationId: "org-1",
      page: 2,
      limit: 2,
    });

    expect(result.pagination).toEqual({
      page: 2,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "message-1",
      organizationId: "org-1",
      organizationName: "Tyvera Clinic",
      recipientMasked: "*******4567",
      channel: "sms",
      deliveryStatus: "failed",
      unitsConsumed: 2,
    });
    expect(result.items[0]).not.toHaveProperty("content");
    expect(result.items[0]).not.toHaveProperty("providerMetadata");

    const executedSql = executeMock.mock.calls.map(([query]) => sqlChunks(query)).join("\n");
    expect(executedSql).toContain("me.channel");
    expect(executedSql).toContain("me.delivery_status");
    expect(executedSql).toContain("b.organization_id");
  });

  it("binds list timestamp filters as timestamp strings instead of Date objects", async () => {
    executeMock.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);

    await new PlatformAdminCommunicationsService().listCommunications({
      from: "2026-06-06T12:00:00.000Z",
      to: "2026-06-07T12:00:00.000Z",
    });

    const params = executeMock.mock.calls.flatMap(([query]) => sqlBoundValues(query));
    expect(params.some((param) => param instanceof Date)).toBe(false);
    expect(params).toContain("2026-06-06T12:00:00.000Z");
    expect(params).toContain("2026-06-07T12:00:00.000Z");
    const executedSql = executeMock.mock.calls.map(([query]) => sqlChunks(query)).join("\n");
    expect(executedSql).toContain("me.created_at >=");
    expect(executedSql).toContain("me.created_at <=");
    expect(executedSql).toContain("::timestamptz");
  });


  it("masks email recipients in list responses", async () => {
    executeMock
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([
        {
          id: "message-email",
          organizationId: "org-1",
          organizationName: "Tyvera Clinic",
          businessId: "business-1",
          businessName: "Main Branch",
          appointmentId: null,
          customerId: "customer-1",
          customerName: "Romeo Angeles",
          recipientRaw: "romeo@example.com",
          channel: "email",
          automationKey: "post_visit_followup",
          purpose: "transactional",
          status: "sent",
          deliveryStatus: "delivered",
          provider: "resend",
          retryCount: 0,
          unitsConsumed: 1,
          failureReason: null,
          sentAt: null,
          createdAt: new Date("2026-06-07T09:59:00.000Z"),
        },
      ]);

    const result = await new PlatformAdminCommunicationsService().listCommunications({
      channel: "email",
    });

    expect(result.items[0].recipientMasked).toBe("r***@example.com");
  });

  it("returns detail with related manual follow-up task and no raw provider metadata", async () => {
    executeMock
      .mockResolvedValueOnce([
        {
          id: "message-1",
          organizationId: "org-1",
          organizationName: "Tyvera Clinic",
          businessId: "business-1",
          businessName: "Main Branch",
          customerId: "customer-1",
          customerName: "Romeo Angeles",
          recipientRaw: "+639171234567",
          appointmentId: "appointment-1",
          automationKey: "appointment_reminder_24h",
          purpose: "transactional",
          channel: "sms",
          status: "failed",
          deliveryStatus: "failed",
          provider: "semaphore",
          providerMessageId: "provider-1",
          retryCount: 1,
          unitsConsumed: 2,
          failureReason: "semaphore_failed",
          sentAt: null,
          createdAt: new Date("2026-06-07T09:59:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "task-1",
          status: "open",
          failureReason: "semaphore_failed",
          createdAt: new Date("2026-06-07T10:01:00.000Z"),
          resolvedAt: null,
        },
      ]);

    const detail = await new PlatformAdminCommunicationsService().getCommunicationDetail("message-1");

    expect(detail).toMatchObject({
      id: "message-1",
      organization: { id: "org-1", name: "Tyvera Clinic" },
      customer: {
        id: "customer-1",
        name: "Romeo Angeles",
        recipientMasked: "*******4567",
      },
      manualFollowUpTask: {
        id: "task-1",
        status: "open",
        failureReason: "semaphore_failed",
      },
    });
    expect(detail).not.toHaveProperty("providerMetadata");
  });

  it("throws not found when a message detail does not exist", async () => {
    executeMock.mockResolvedValueOnce([]);

    await expect(
      new PlatformAdminCommunicationsService().getCommunicationDetail("missing"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    ["24h", "hour", "2026-06-06T12:00:00.000Z"],
    ["7d", "day", "2026-05-31T12:00:00.000Z"],
    ["30d", "day", "2026-05-08T12:00:00.000Z"],
  ] as const)("summarizes %s communications with %s buckets", async (range, bucketUnit, expectedStart) => {
    executeMock
      .mockResolvedValueOnce([
        {
          smsQueued: 1,
          smsSent: 7,
          smsFailed: 2,
          smsDelivered: 5,
          emailSent: 6,
          emailDelivered: 4,
          emailFailed: 1,
          emailBounced: 1,
          emailRejected: 1,
        },
      ])
      .mockResolvedValueOnce([{ openManualFollowUps: 3 }])
      .mockResolvedValueOnce([{ otpSendFailures: 2, otpTotal: 5 }])
      .mockResolvedValueOnce([
        {
          bucket: new Date("2026-06-07T10:00:00.000Z"),
          smsSent: 4,
          smsFailed: 1,
          emailDelivered: 3,
          emailFailed: 1,
          otpFailures: 2,
        },
      ]);

    const summary = await new PlatformAdminCommunicationsService().getSummary({ range });

    expect(summary.range).toBe(range);
    expect(summary.totals).toMatchObject({
      smsSent: 7,
      smsFailed: 2,
      emailDelivered: 4,
      emailFailed: 1,
      openManualFollowUps: 3,
      otpSendFailures: 2,
    });
    expect(summary.failureRates.smsFailureRatePct).toBe(22.22);
    expect(summary.failureRates.emailFailureRatePct).toBe(14.29);
    expect(summary.failureRates.otpFailureRatePct).toBe(40);
    expect(summary.series[0]).toMatchObject({
      smsSent: 4,
      smsFailed: 1,
      emailDelivered: 3,
      emailFailed: 1,
      otpFailures: 2,
    });

    const executedSql = executeMock.mock.calls.map(([query]) => sqlChunks(query)).join("\n");
    expect(executedSql).toContain(`date_trunc('${bucketUnit}'`);
    const params = executeMock.mock.calls.flatMap(([query]) => sqlBoundValues(query));
    expect(params.some((param) => param instanceof Date)).toBe(false);
    expect(params).toContain(expectedStart);
    expect(executedSql).toContain("created_at >=");
    expect(executedSql).toContain("::timestamptz");
  });

  it("counts queued SMS with explicit delivery/status checks instead of enum coalesce", async () => {
    executeMock
      .mockResolvedValueOnce([{ smsQueued: 2 }])
      .mockResolvedValueOnce([{ openManualFollowUps: 0 }])
      .mockResolvedValueOnce([{ otpSendFailures: 0, otpTotal: 0 }])
      .mockResolvedValueOnce([]);

    const summary = await new PlatformAdminCommunicationsService().getSummary({
      range: "24h",
    });

    expect(summary.totals.smsQueued).toBe(2);
    const executedSql = sqlChunks(executeMock.mock.calls[0][0]);
    expect(executedSql).not.toContain("coalesce(me.delivery_status, me.status)");
    expect(executedSql).toContain("me.delivery_status = 'queued'");
    expect(executedSql).toContain("me.delivery_status is null");
    expect(executedSql).toContain("me.status = 'queued'");
  });
});
