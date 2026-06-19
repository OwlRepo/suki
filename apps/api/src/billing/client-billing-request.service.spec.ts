import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  auditLogs,
  clientBillingRequests,
  getDb,
  organizations,
} from "@tyvera/database";
import { ClientBillingRequestService } from "./client-billing-request.service";

vi.mock("@tyvera/database", async () => {
  const actual = await vi.importActual<typeof import("@tyvera/database")>(
    "@tyvera/database",
  );
  return { ...actual, getDb: vi.fn() };
});

function createHarness(input?: {
  organization?: Record<string, unknown>;
  requests?: Array<Record<string, unknown>>;
}) {
  const state = {
    organization: input?.organization ?? {
      id: "org-1",
      currentPlan: "starter",
    },
    requests: [...(input?.requests ?? [])],
    inserted: [] as Array<Record<string, unknown>>,
    audit: [] as Array<Record<string, unknown>>,
    updated: [] as Array<Record<string, unknown>>,
  };

  const select = vi.fn(() => ({
    from: (table: unknown) => ({
      where: () => ({
        limit: async () => {
          if (table === organizations) return [state.organization];
          if (table === clientBillingRequests) return state.requests.slice(0, 1);
          return [];
        },
        orderBy: async () => {
          if (table === clientBillingRequests) return state.requests;
          return [];
        },
      }),
      orderBy: async () => {
        if (table === clientBillingRequests) return state.requests;
        return [];
      },
    }),
  }));
  const insert = vi.fn((table: unknown) => ({
    values: (value: Record<string, unknown>) => ({
      returning: async () => {
        if (table === clientBillingRequests) {
          const row = {
            id: `client-request-${state.requests.length + 1}`,
            status: "submitted",
            createdAt: new Date("2026-06-19T00:00:00.000Z"),
            updatedAt: new Date("2026-06-19T00:00:00.000Z"),
            ...value,
          };
          state.requests.push(row);
          state.inserted.push(row);
          return [row];
        }
        if (table === auditLogs) state.audit.push(value);
        return [value];
      },
      then: (
        resolve: (value?: unknown) => unknown,
        reject: (reason?: unknown) => unknown,
      ) => {
        if (table === auditLogs) state.audit.push(value);
        return Promise.resolve(undefined).then(resolve, reject);
      },
    }),
  }));
  const update = vi.fn((table: unknown) => ({
    set: (value: Record<string, unknown>) => ({
      where: () => ({
        returning: async () => {
          if (table !== clientBillingRequests || !state.requests[0]) return [];
          state.requests[0] = { ...state.requests[0], ...value };
          state.updated.push(value);
          return [state.requests[0]];
        },
      }),
    }),
  }));

  vi.mocked(getDb).mockReturnValue({ select, insert, update } as never);
  return state;
}

function createService(flags = { selfServe: false, manual: true }) {
  return new ClientBillingRequestService({
    selfServeBillingEnabled: vi.fn(() => flags.selfServe),
    manualBillingControlsEnabled: vi.fn(() => flags.manual),
  } as never);
}

describe("ClientBillingRequestService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates paid plan changes different from current plan and audits them", async () => {
    const state = createHarness();
    const created = await createService().create({
      organizationId: "org-1",
      requestedByUserId: "user-1",
      kind: "plan_change",
      requestedPlanType: "growth",
      note: "Need more capacity",
    });

    expect(created).toMatchObject({
      kind: "plan_change",
      requestedPlanType: "growth",
      status: "submitted",
    });
    expect(state.audit[0]).toMatchObject({
      action: "client_billing_request.created",
      entity: "client_billing_request",
    });
  });

  it("rejects free, current-plan, invalid SMS, and malformed cancellation requests", async () => {
    createHarness();
    const service = createService();

    await expect(
      service.create({
        organizationId: "org-1",
        requestedByUserId: "user-1",
        kind: "plan_change",
        requestedPlanType: "free",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({
        organizationId: "org-1",
        requestedByUserId: "user-1",
        kind: "plan_change",
        requestedPlanType: "starter",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({
        organizationId: "org-1",
        requestedByUserId: "user-1",
        kind: "sms_topup",
        requestedSku: "online-booking-topup-10",
        requestedQuantity: 0,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create({
        organizationId: "org-1",
        requestedByUserId: "user-1",
        kind: "cancellation",
        requestedPlanType: "starter",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates valid SMS and bare cancellation requests", async () => {
    const smsState = createHarness();

    await createService().create({
      organizationId: "org-1",
      requestedByUserId: "user-1",
      kind: "sms_topup",
      requestedSku: "sms-segment-topup-25",
      requestedQuantity: 2,
    });
    const cancellationState = createHarness();
    await createService().create({
      organizationId: "org-1",
      requestedByUserId: "user-1",
      kind: "cancellation",
      note: "Closing workspace",
    });

    expect(smsState.inserted[0]).toMatchObject({ kind: "sms_topup" });
    expect(cancellationState.inserted[0]).toMatchObject({
      kind: "cancellation",
    });
  });

  it("rejects cancellation from the free plan", async () => {
    createHarness({
      organization: { id: "org-1", currentPlan: "free" },
    });

    await expect(
      createService().create({
        organizationId: "org-1",
        requestedByUserId: "user-1",
        kind: "cancellation",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("blocks duplicate open requests by kind", async () => {
    createHarness({
      requests: [
        {
          id: "client-request-1",
          organizationId: "org-1",
          kind: "plan_change",
          status: "under_review",
        },
      ],
    });

    await expect(
      createService().create({
        organizationId: "org-1",
        requestedByUserId: "user-1",
        kind: "plan_change",
        requestedPlanType: "growth",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("allows creation only in manual billing mode", async () => {
    createHarness();
    await expect(
      createService({ selfServe: true, manual: true }).create({
        organizationId: "org-1",
        requestedByUserId: "user-1",
        kind: "cancellation",
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(
      createService({ selfServe: false, manual: false }).create({
        organizationId: "org-1",
        requestedByUserId: "user-1",
        kind: "cancellation",
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("lists only organization requests and cancels open requests", async () => {
    const state = createHarness({
      requests: [
        {
          id: "client-request-1",
          organizationId: "org-1",
          kind: "sms_topup",
          status: "submitted",
        },
      ],
    });
    const service = createService();

    await expect(service.listForOrganization("org-1")).resolves.toHaveLength(1);
    await expect(
      service.cancel("org-1", "client-request-1"),
    ).resolves.toMatchObject({ status: "cancelled" });
    expect(state.updated[0]).toMatchObject({ status: "cancelled" });
  });
});
