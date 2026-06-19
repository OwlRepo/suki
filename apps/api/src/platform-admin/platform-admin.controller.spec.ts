import { describe, expect, it, vi } from "vitest";
import { PLATFORM_ADMIN_PERMISSIONS_KEY } from "./platform-admin.decorator";
import { PlatformAdminController } from "./platform-admin.controller";
import type { PlatformAdminRequest } from "./platform-admin.guard";

const actor = {
  id: "platform-admin-1",
  userId: "founder-user-1",
  roleCodes: ["FOUNDER"] as const,
  permissions: new Set(["PLATFORM_ADMIN_ACCESS"]),
};

function createController() {
  const billing = {
    listManualBillingCatalog: vi.fn(() => ({
      manualBillingControlsEnabled: true,
      items: [],
    })),
    createBillingRequest: vi.fn(),
    sendPaymentRequestEmail: vi.fn(),
    sendPaymentAcknowledgmentEmail: vi.fn(),
    updateOrganizationBillingContact: vi.fn(),
    updateManualSubscriptionStatus: vi.fn(),
    listClientBillingRequests: vi.fn(),
    getClientBillingRequest: vi.fn(),
    startClientBillingRequestReview: vi.fn(),
    approveClientBillingRequest: vi.fn(),
    declineClientBillingRequest: vi.fn(),
  };
  const controller = new PlatformAdminController(
    { serializeSession: vi.fn() } as never,
    billing as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const request = { platformAdmin: actor } as unknown as PlatformAdminRequest;
  return { billing, controller, request };
}

describe("PlatformAdminController manual subscriptions", () => {
  it("exposes the manual billing catalog", () => {
    const { billing, controller } = createController();

    expect(controller.listManualBillingCatalog()).toEqual({
      manualBillingControlsEnabled: true,
      items: [],
    });
    expect(billing.listManualBillingCatalog).toHaveBeenCalledOnce();
  });

  it("passes a manual subscription SKU to request creation", async () => {
    const { billing, controller, request } = createController();
    billing.createBillingRequest.mockResolvedValue({ ok: true });

    await controller.createBillingRequest(request, {
      organizationId: "org-1",
      sku: "starter-monthly",
      quantity: 1,
      coverageStartsAt: null,
    });

    expect(billing.createBillingRequest).toHaveBeenCalledWith(actor, {
      organizationId: "org-1",
      sku: "starter-monthly",
      quantity: 1,
      coverageStartsAt: null,
    });
  });

  it("delegates billing-contact updates with the active platform admin", async () => {
    const { billing, controller, request } = createController();

    await controller.updateOrganizationBillingContact(
      request,
      "org-1",
      { billingContactMobile: "+639171234567" },
    );

    expect(billing.updateOrganizationBillingContact).toHaveBeenCalledWith(
      actor,
      "org-1",
      { billingContactMobile: "+639171234567" },
    );
  });

  it("delegates lifecycle actions for service-level permission enforcement", async () => {
    const { billing, controller, request } = createController();

    await controller.updateManualSubscriptionStatus(request, "org-1", {
      action: "suspend",
      reason: "Payment unresolved",
    });

    expect(billing.updateManualSubscriptionStatus).toHaveBeenCalledWith(
      actor,
      "org-1",
      {
        action: "suspend",
        reason: "Payment unresolved",
      },
    );
  });

  it("routes manual payment-request resend", async () => {
    const { billing, controller, request } = createController();
    billing.sendPaymentRequestEmail.mockResolvedValue({ status: "sent" });

    await controller.sendPaymentRequestEmail(request, "request-1");

    expect(billing.sendPaymentRequestEmail).toHaveBeenCalledWith(
      actor,
      "request-1",
    );
  });

  it("routes payment-acknowledgment resend", async () => {
    const { billing, controller, request } = createController();
    billing.sendPaymentAcknowledgmentEmail.mockResolvedValue({
      status: "sent",
    });

    await controller.sendPaymentAcknowledgmentEmail(request, "request-1");

    expect(billing.sendPaymentAcknowledgmentEmail).toHaveBeenCalledWith(
      actor,
      "request-1",
    );
  });

  it("requires platform-admin permission decorators for resend routes", () => {
    expect(
      Reflect.getMetadata(
        PLATFORM_ADMIN_PERMISSIONS_KEY,
        PlatformAdminController.prototype.sendPaymentRequestEmail,
      ),
    ).toEqual(["BILLING_REQUEST_VIEW"]);
    expect(
      Reflect.getMetadata(
        PLATFORM_ADMIN_PERMISSIONS_KEY,
        PlatformAdminController.prototype.sendPaymentAcknowledgmentEmail,
      ),
    ).toEqual(["PAYMENT_VIEW"]);
  });

  it("routes client billing inbox actions with active admin", async () => {
    const { billing, controller, request } = createController();

    await controller.listClientBillingRequests(request, "submitted");
    await controller.getClientBillingRequest(request, "client-request-1");
    await controller.startClientBillingRequestReview(
      request,
      "client-request-1",
    );
    await controller.approveClientBillingRequest(
      request,
      "client-request-1",
      { decisionNote: "Approved" },
    );
    await controller.declineClientBillingRequest(
      request,
      "client-request-1",
      { decisionNote: "Declined" },
    );

    expect(billing.listClientBillingRequests).toHaveBeenCalledWith(actor, {
      status: "submitted",
    });
    expect(billing.getClientBillingRequest).toHaveBeenCalledWith(
      actor,
      "client-request-1",
    );
    expect(billing.startClientBillingRequestReview).toHaveBeenCalledWith(
      actor,
      "client-request-1",
    );
    expect(billing.approveClientBillingRequest).toHaveBeenCalledWith(
      actor,
      "client-request-1",
      { decisionNote: "Approved" },
    );
    expect(billing.declineClientBillingRequest).toHaveBeenCalledWith(
      actor,
      "client-request-1",
      { decisionNote: "Declined" },
    );
  });

  it("requires client request view and resolve permissions", () => {
    expect(
      Reflect.getMetadata(
        PLATFORM_ADMIN_PERMISSIONS_KEY,
        PlatformAdminController.prototype.listClientBillingRequests,
      ),
    ).toEqual(["CLIENT_BILLING_REQUEST_VIEW"]);
    expect(
      Reflect.getMetadata(
        PLATFORM_ADMIN_PERMISSIONS_KEY,
        PlatformAdminController.prototype.approveClientBillingRequest,
      ),
    ).toEqual(["CLIENT_BILLING_REQUEST_RESOLVE"]);
    expect(
      Reflect.getMetadata(
        PLATFORM_ADMIN_PERMISSIONS_KEY,
        PlatformAdminController.prototype.declineClientBillingRequest,
      ),
    ).toEqual(["CLIENT_BILLING_REQUEST_RESOLVE"]);
  });
});
