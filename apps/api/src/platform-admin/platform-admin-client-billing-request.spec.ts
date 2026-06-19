import {
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { getDb, organizations } from "@tyvera/database";
import type { ActivePlatformAdmin } from "./platform-admin.service";
import { PlatformAdminBillingService } from "./platform-admin-billing.service";

vi.mock("@tyvera/database", async () => {
  const actual = await vi.importActual<typeof import("@tyvera/database")>(
    "@tyvera/database",
  );
  return { ...actual, getDb: vi.fn() };
});

const actor: ActivePlatformAdmin = {
  id: "admin-1",
  userId: "user-admin-1",
  roleCodes: ["FINANCE"],
  permissions: new Set([
    "CLIENT_BILLING_REQUEST_VIEW",
    "CLIENT_BILLING_REQUEST_RESOLVE",
    "BILLING_REQUEST_CREATE",
    "SUBSCRIPTION_CHANGE_PLAN",
  ]),
};

function createService(request: Record<string, unknown>) {
  const insert = vi.fn(() => ({
    values: vi.fn(async () => undefined),
  }));
  const select = vi.fn(() => ({
    from: (table: unknown) => ({
      where: () => ({
        limit: async () =>
          table === organizations
            ? [{ id: "org-1", name: "Tyvera Clinic" }]
            : [],
      }),
    }),
  }));
  vi.mocked(getDb).mockReturnValue({ insert, select } as never);
  const clientRequests = {
    getByIdOrThrow: vi.fn(async () => request),
    listByStatus: vi.fn(async () => [request]),
    markUnderReview: vi.fn(async () => ({
      ...request,
      status: "under_review",
    })),
    markDeclined: vi.fn(async (_id, _adminId, decisionNote) => ({
      ...request,
      status: "declined",
      decisionNote,
    })),
    markApprovedLinked: vi.fn(
      async (_id, _adminId, linkedBillingRequestId, decisionNote) => ({
        ...request,
        status: "approved",
        linkedBillingRequestId,
        decisionNote,
      }),
    ),
  };
  const service = new PlatformAdminBillingService(
    {} as never,
    {} as never,
    { manualBillingControlsEnabled: vi.fn(() => true) } as never,
    {} as never,
    clientRequests as never,
  );
  vi.spyOn(service, "createBillingRequest").mockResolvedValue({
    billingRequest: { id: "manual-request-1" },
  } as never);
  return { clientRequests, service };
}

describe("PlatformAdminBillingService client requests", () => {
  it("approves plan changes through createBillingRequest and links result", async () => {
    const { clientRequests, service } = createService({
      id: "client-request-1",
      organizationId: "org-1",
      kind: "plan_change",
      requestedPlanType: "growth",
      status: "submitted",
    });

    await service.approveClientBillingRequest(actor, "client-request-1", {
      decisionNote: "Approved",
    });

    expect(service.createBillingRequest).toHaveBeenCalledWith(actor, {
      organizationId: "org-1",
      sku: "growth-monthly",
      quantity: 1,
      notes: "Approved",
    });
    expect(clientRequests.markApprovedLinked).toHaveBeenCalledWith(
      "client-request-1",
      "admin-1",
      "manual-request-1",
      "Approved",
    );
  });

  it("approves SMS topups with requested SKU and quantity", async () => {
    const { service } = createService({
      id: "client-request-1",
      organizationId: "org-1",
      kind: "sms_topup",
      requestedSku: "sms-segment-topup-50",
      requestedQuantity: 3,
      status: "under_review",
    });

    await service.approveClientBillingRequest(actor, "client-request-1", {});

    expect(service.createBillingRequest).toHaveBeenCalledWith(actor, {
      organizationId: "org-1",
      sku: "sms-segment-topup-50",
      quantity: 3,
      notes: null,
    });
  });

  it("approves cancellation without billing request and requires decision note", async () => {
    const { clientRequests, service } = createService({
      id: "client-request-1",
      organizationId: "org-1",
      kind: "cancellation",
      status: "submitted",
    });

    await expect(
      service.approveClientBillingRequest(actor, "client-request-1", {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    await service.approveClientBillingRequest(actor, "client-request-1", {
      decisionNote: "Cancel after final service date",
    });

    expect(service.createBillingRequest).not.toHaveBeenCalled();
    expect(clientRequests.markApprovedLinked).toHaveBeenCalledWith(
      "client-request-1",
      "admin-1",
      null,
      "Cancel after final service date",
    );
  });

  it("starts review and declines with a note", async () => {
    const { clientRequests, service } = createService({
      id: "client-request-1",
      organizationId: "org-1",
      kind: "plan_change",
      status: "submitted",
    });

    await service.startClientBillingRequestReview(actor, "client-request-1");
    await service.declineClientBillingRequest(actor, "client-request-1", {
      decisionNote: "Need account verification",
    });

    expect(clientRequests.markUnderReview).toHaveBeenCalledWith(
      "client-request-1",
      "admin-1",
    );
    expect(clientRequests.markDeclined).toHaveBeenCalledWith(
      "client-request-1",
      "admin-1",
      "Need account verification",
    );
  });

  it("denies resolution without CLIENT_BILLING_REQUEST_RESOLVE", async () => {
    const { service } = createService({
      id: "client-request-1",
      organizationId: "org-1",
      kind: "cancellation",
      status: "submitted",
    });
    const viewOnly = {
      ...actor,
      permissions: new Set(["CLIENT_BILLING_REQUEST_VIEW"] as const),
    };

    await expect(
      service.startClientBillingRequestReview(
        viewOnly as ActivePlatformAdmin,
        "client-request-1",
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
