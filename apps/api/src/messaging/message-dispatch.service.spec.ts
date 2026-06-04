import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessageDispatchService } from "./message-dispatch.service";

type SelectResult = unknown[];

const dbState = {
  selectResults: [] as SelectResult[],
  whereResults: [] as SelectResult[],
  inserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
};

vi.mock("@tyvera/database", () => ({
  getDb: () => ({
    select: () => {
      const query = {
        from: () => query,
        innerJoin: () => query,
        where: () => query,
        limit: () => Promise.resolve(dbState.selectResults.shift() ?? []),
        then: (resolve: (value: SelectResult) => void) =>
          Promise.resolve(dbState.whereResults.shift() ?? []).then(resolve),
      };
      return query;
    },
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        dbState.inserts.push(values);
        return {
          returning: () =>
            Promise.resolve([{ id: `evt-${dbState.inserts.length}`, ...values }]),
        };
      },
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        dbState.updates.push(values);
        return { where: () => Promise.resolve(undefined) };
      },
    }),
  }),
  businesses: { id: "businessId", organizationId: "organizationId" },
  customers: {
    id: "customerId",
    mobile: "mobile",
    email: "email",
    smsOptedOutAt: "smsOptedOutAt",
    allowTransactionalSms: "allowTransactionalSms",
    allowPromotionalSms: "allowPromotionalSms",
    emailOptedOutAt: "emailOptedOutAt",
    allowTransactionalEmail: "allowTransactionalEmail",
    allowPromotionalEmail: "allowPromotionalEmail",
  },
  messageEvents: {
    id: "id",
    businessId: "businessId",
    status: "status",
    sentBy: "sentBy",
    createdAt: "createdAt",
  },
}));

function makeService(smsProviderResult: Record<string, unknown>) {
  const planCapacity = {
    getActivePlan: vi.fn(async () => "starter"),
    hasModuleAccess: vi.fn(() => true),
    isReadOnly: vi.fn(async () => false),
  };
  const policy = {
    canSend: vi.fn(() => ({ allowed: true })),
  };
  const smsMetering = {
    canConsume: vi.fn(async () => ({ allowed: true })),
    consume: vi.fn(async () => undefined),
  };
  const emailMetering = {
    canConsume: vi.fn(async () => ({ allowed: true })),
    consume: vi.fn(async () => undefined),
  };
  const smsProvider = {
    providerName: smsProviderResult.provider,
    send: vi.fn(async () => smsProviderResult),
  };
  const emailProvider = {
    send: vi.fn(),
  };
  const manualFollowUps = {
    createFromMessageEvent: vi.fn(async () => undefined),
  };
  return {
    service: new MessageDispatchService(
      planCapacity as never,
      policy as never,
      smsMetering as never,
      emailMetering as never,
      smsProvider as never,
      emailProvider as never,
      manualFollowUps as never,
    ),
    smsMetering,
    smsProvider,
    manualFollowUps,
  };
}

function seedDb() {
  dbState.selectResults = [
    [
      {
        id: "cust-1",
        mobile: "+639171234567",
        smsOptedOutAt: null,
        allowTransactionalSms: true,
        allowPromotionalSms: true,
        emailOptedOutAt: null,
        allowTransactionalEmail: true,
        allowPromotionalEmail: true,
      },
    ],
    [{ id: "biz-1", organizationId: "org-1" }],
  ];
  dbState.whereResults = [[{ count: 0 }], [{ count: 0 }]];
}

const input = {
  organizationId: "org-1",
  businessId: "biz-1",
  customerId: "cust-1",
  automationKey: "appointment_reminder_24h" as const,
  purpose: "transactional" as const,
  channel: "sms" as const,
  rawMessage: "a".repeat(160),
};

describe("MessageDispatchService SMS hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbState.selectResults = [];
    dbState.whereResults = [];
    dbState.inserts = [];
    dbState.updates = [];
  });

  it("finalizes the SMS body before checking segment credits", async () => {
    seedDb();
    const { service, smsMetering, smsProvider } = makeService({
      ok: true,
      providerMessageId: "SM1",
    });

    await service.dispatch(input);

    expect(smsMetering.canConsume).toHaveBeenCalledWith("org-1", 2);
    expect(smsProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("Reply STOP to opt out."),
      }),
    );
  });

  it("skips sending when credits cannot cover the finalized segment count", async () => {
    seedDb();
    const { service, smsMetering, smsProvider } = makeService({
      ok: true,
      providerMessageId: "SM1",
    });
    smsMetering.canConsume.mockResolvedValueOnce({
      allowed: false,
      reason: "sms_cap_reached",
    } as never);

    await expect(service.dispatch(input)).resolves.toEqual(
      expect.objectContaining({ status: "skipped", reason: "sms_cap_reached" }),
    );

    expect(smsMetering.canConsume).toHaveBeenCalledWith("org-1", 2);
    expect(smsProvider.send).not.toHaveBeenCalled();
  });

  it("consumes calculated segments once after a successful send and stores provider metadata", async () => {
    seedDb();
    const { service, smsMetering } = makeService({
      ok: true,
      provider: "semaphore",
      providerMessageId: "SM1",
      providerMetadata: { num_segments: "3", status: "queued" },
    });

    await service.dispatch(input);

    expect(smsMetering.consume).toHaveBeenCalledWith(
      "org-1",
      "biz-1",
      "evt-1",
      2,
    );
    expect(dbState.updates).toContainEqual(
      expect.objectContaining({
        provider: "semaphore",
        providerMetadata: expect.objectContaining({
          estimatedSegments: 2,
          providerNumSegments: 3,
        }),
      }),
    );
  });

  it("does not retry ambiguous unknown-outcome provider failures", async () => {
    seedDb();
    const { service, smsMetering, smsProvider, manualFollowUps } = makeService({
      ok: false,
      provider: "semaphore",
      transient: true,
      safeToRetry: false,
      errorCode: "provider_outcome_unknown",
    });

    await expect(service.dispatch(input)).resolves.toEqual(
      expect.objectContaining({
        status: "failed",
        reason: "provider_outcome_unknown",
      }),
    );

    expect(smsProvider.send).toHaveBeenCalledTimes(1);
    expect(smsMetering.consume).not.toHaveBeenCalled();
    expect(dbState.updates).toContainEqual(
      expect.objectContaining({
        failureReason: "provider_outcome_unknown",
        provider: "semaphore",
      }),
    );
    expect(manualFollowUps.createFromMessageEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        businessId: "biz-1",
        originalMessageEventId: "evt-1",
        fallbackFailureReason: "provider_outcome_unknown",
      }),
    );
  });

  it("retry-failed branch persists provider and creates one task", async () => {
    seedDb();
    const { service, smsProvider, manualFollowUps } = makeService({
      ok: false,
      provider: "semaphore",
      transient: true,
      safeToRetry: true,
      errorCode: "provider_transient_retryable",
    });
    smsProvider.send
      .mockResolvedValueOnce({
        ok: false,
        provider: "semaphore",
        transient: true,
        safeToRetry: true,
        errorCode: "provider_transient_retryable",
      })
      .mockResolvedValueOnce({
        ok: false,
        provider: "semaphore",
        providerMessageId: "SEM2",
        errorCode: "provider_rejected",
      });

    await service.dispatch(input);

    expect(dbState.updates).toContainEqual(
      expect.objectContaining({
        status: "failed",
        retryCount: 1,
        provider: "semaphore",
        providerMessageId: "SEM2",
      }),
    );
    expect(manualFollowUps.createFromMessageEvent).toHaveBeenCalledTimes(1);
  });

  it("sent SMS creates no manual task", async () => {
    seedDb();
    const { service, manualFollowUps } = makeService({
      ok: true,
      provider: "semaphore",
      providerMessageId: "SEM1",
    });

    await service.dispatch(input);

    expect(manualFollowUps.createFromMessageEvent).not.toHaveBeenCalled();
  });

  it("retries safe transient failures at most once and consumes credits once on retry success", async () => {
    seedDb();
    const { service, smsMetering, smsProvider } = makeService({
      ok: false,
      transient: true,
      safeToRetry: true,
      errorCode: "provider_transient_retryable",
    });
    smsProvider.send
      .mockResolvedValueOnce({
        ok: false,
        transient: true,
        safeToRetry: true,
        errorCode: "provider_transient_retryable",
      })
      .mockResolvedValueOnce({
        ok: true,
        provider: "semaphore",
        providerMessageId: "SM2",
      });

    await service.dispatch(input);

    expect(smsProvider.send).toHaveBeenCalledTimes(2);
    expect(smsMetering.consume).toHaveBeenCalledTimes(1);
    expect(smsMetering.consume).toHaveBeenCalledWith(
      "org-1",
      "biz-1",
      "evt-1",
      2,
    );
    expect(dbState.updates).toContainEqual(
      expect.objectContaining({
        provider: "semaphore",
        retryCount: 1,
      }),
    );
  });

  it("omits STOP footer when the selected SMS provider is Semaphore", async () => {
    seedDb();
    const { service, smsProvider } = makeService({
      ok: true,
      provider: "semaphore",
      providerMessageId: "SEM1",
    });

    await service.dispatch(input);

    expect(smsProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.not.stringContaining("Reply STOP to opt out."),
      }),
    );
    expect(smsProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("Sent automatically by Tyvera"),
      }),
    );
  });
});
