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
});
