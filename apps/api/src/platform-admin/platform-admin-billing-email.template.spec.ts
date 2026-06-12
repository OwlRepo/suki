import { describe, expect, it } from "vitest";
import {
  buildManualBillingPaymentAcknowledgmentEmail,
  buildManualBillingPaymentRequestEmail,
  buildManualBillingProFormaInvoiceAttachment,
  buildManualBillingProFormaInvoiceContent,
} from "./platform-admin-billing-email.template";

const subscriptionItem = {
  sku: "pro-monthly",
  purchaseKind: "subscription",
  planType: "pro",
  billingInterval: "monthly",
  coverageStartsAt: new Date("2026-06-12T00:00:00.000Z"),
  coverageEndsAt: new Date("2026-07-12T00:00:00.000Z"),
  quantity: 1,
  units: 1,
};

const addonItem = {
  sku: "sms-segment-topup-25",
  purchaseKind: "sms_segment_topup",
  quantity: 1,
  units: 25,
};

describe("platform-admin billing email templates", () => {
  it("builds subscription payment-request wording", () => {
    const result = buildManualBillingPaymentRequestEmail({
      organizationName: "Tyvera Clinic",
      referenceNumber: "TYV-2026-000001",
      totalAmountPhp: 5_999,
      paymentInstructions: "GCash: 09171234567 (Tyvera)",
      items: [subscriptionItem],
    });

    expect(result.subject).toContain("Tyvera Payment Request");
    expect(result.body).toContain("Plan: Pro Monthly");
    expect(result.body).toContain(
      "Your subscription will activate after verification.",
    );
  });

  it("builds add-on payment-request wording without subscription language", () => {
    const result = buildManualBillingPaymentRequestEmail({
      organizationName: "Tyvera Clinic",
      referenceNumber: "TYV-2026-000001",
      totalAmountPhp: 599,
      paymentInstructions: "GCash: 09171234567 (Tyvera)",
      items: [addonItem],
    });

    expect(result.body).toContain("Package: sms-segment-topup-25");
    expect(result.body).toContain("Credits will be applied after verification.");
    expect(result.body).not.toContain("subscription will activate");
  });

  it("includes due date only when present", () => {
    const withoutDueDate = buildManualBillingPaymentRequestEmail({
      organizationName: "Tyvera Clinic",
      referenceNumber: "TYV-2026-000001",
      totalAmountPhp: 599,
      paymentInstructions: "Use the configured payment account.",
      items: [addonItem],
    });
    const withDueDate = buildManualBillingPaymentRequestEmail({
      organizationName: "Tyvera Clinic",
      referenceNumber: "TYV-2026-000001",
      totalAmountPhp: 599,
      dueAt: new Date("2026-06-20T00:00:00.000Z"),
      paymentInstructions: "Use the configured payment account.",
      items: [addonItem],
    });

    expect(withoutDueDate.body).not.toContain("Due date:");
    expect(withDueDate.body).toContain("Due date: Jun 20, 2026");
  });

  it("includes subscription coverage when present", () => {
    const result = buildManualBillingPaymentRequestEmail({
      organizationName: "Tyvera Clinic",
      referenceNumber: "TYV-2026-000001",
      totalAmountPhp: 5_999,
      paymentInstructions: "Use the configured payment account.",
      items: [subscriptionItem],
    });

    expect(result.body).toContain("Coverage: Jun 12, 2026 to Jul 12, 2026");
  });

  it("builds subscription acknowledgment wording", () => {
    const result = buildManualBillingPaymentAcknowledgmentEmail({
      organizationName: "Tyvera Clinic",
      referenceNumber: "TYV-2026-000001",
      verifiedAmountPhp: 5_999,
      paymentMethod: "gcash",
      items: [subscriptionItem],
    });

    expect(result.subject).toContain("Tyvera Payment Acknowledgment");
    expect(result.body).toContain("Status: Verified");
    expect(result.body).toContain("Plan: Pro Monthly");
    expect(result.body).toContain("Coverage: Jun 12, 2026 to Jul 12, 2026");
    expect(result.body).toContain("Subscription status: Activated");
  });

  it("builds add-on acknowledgment wording", () => {
    const result = buildManualBillingPaymentAcknowledgmentEmail({
      organizationName: "Tyvera Clinic",
      referenceNumber: "TYV-2026-000001",
      verifiedAmountPhp: 599,
      paymentMethod: "bank_transfer",
      items: [addonItem],
    });

    expect(result.body).toContain("Package: sms-segment-topup-25");
    expect(result.body).toContain("Status: Verified");
    expect(result.body).toContain("Credit status: Applied");
    expect(result.body).not.toContain("Activated");
  });

  it("never labels email output as an official receipt or tax invoice", () => {
    const request = buildManualBillingPaymentRequestEmail({
      organizationName: "Tyvera Clinic",
      referenceNumber: "TYV-2026-000001",
      totalAmountPhp: 599,
      paymentInstructions: "Use the configured payment account.",
      items: [addonItem],
    });
    const acknowledgment = buildManualBillingPaymentAcknowledgmentEmail({
      organizationName: "Tyvera Clinic",
      referenceNumber: "TYV-2026-000001",
      verifiedAmountPhp: 599,
      paymentMethod: "gcash",
      items: [addonItem],
    });

    expect(`${request.subject}\n${request.body}`).not.toMatch(
      /official receipt|tax invoice/i,
    );
    expect(`${acknowledgment.subject}\n${acknowledgment.body}`).not.toMatch(
      /official receipt|tax invoice/i,
    );
  });

  it("builds a clearly non-tax pro forma invoice content model", () => {
    const content = buildManualBillingProFormaInvoiceContent({
      organizationName: "Tyvera Clinic",
      referenceNumber: "TYV-2026-000001",
      issuedAt: new Date("2026-06-12T00:00:00.000Z"),
      dueAt: new Date("2026-06-20T00:00:00.000Z"),
      totalAmountPhp: 5_999,
      paymentInstructions: "GCash: 09171234567 (Tyvera)",
      items: [subscriptionItem],
    });

    expect(content.title).toBe("PRO FORMA INVOICE");
    expect(content.sellerName).toBe("Tyvera");
    expect(content.customerName).toBe("Tyvera Clinic");
    expect(content.referenceNumber).toBe("TYV-2026-000001");
    expect(content.lines[0]).toMatchObject({
      description: "Tyvera Pro Monthly subscription",
      detail: "Coverage: Jun 12, 2026 to Jul 12, 2026",
      quantity: 1,
      amountPhp: 5_999,
    });
    expect(content.disclaimer).toMatch(/not a tax invoice/i);
    expect(content.disclaimer).toMatch(/not valid for input tax claims/i);
  });

  it("renders the pro forma invoice as an in-memory PDF attachment", async () => {
    const attachment = await buildManualBillingProFormaInvoiceAttachment({
      organizationName: "Tyvera Clinic",
      referenceNumber: "TYV-2026-000001",
      issuedAt: new Date("2026-06-12T00:00:00.000Z"),
      totalAmountPhp: 599,
      paymentInstructions: "Use the configured payment account.",
      items: [addonItem],
    });

    expect(attachment.filename).toBe(
      "TYV-2026-000001-pro-forma-invoice.pdf",
    );
    expect(attachment.contentType).toBe("application/pdf");
    expect(new TextDecoder().decode(attachment.content.slice(0, 4))).toBe(
      "%PDF",
    );
  });
});
