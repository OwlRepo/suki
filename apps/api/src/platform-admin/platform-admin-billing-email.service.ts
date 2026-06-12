import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  getDb,
  manualBillingEmailDeliveries,
  manualBillingRequestItems,
  manualBillingRequests,
  manualPayments,
  organizations,
} from "@tyvera/database";
import type {
  ManualBillingEmailDeliveryStatus,
  ManualBillingEmailKind,
} from "@tyvera/types";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { FeatureFlagsService } from "../common/feature-flags.service";
import type { IEmailProvider } from "../messaging/providers/email.provider";
import { EMAIL_PROVIDER } from "../messaging/providers/provider.tokens";
import {
  buildManualBillingPaymentAcknowledgmentEmail,
  buildManualBillingPaymentRequestEmail,
  buildManualBillingProFormaInvoiceAttachment,
  type ManualBillingEmailItem,
} from "./platform-admin-billing-email.template";

type DeliveryMode = "automatic" | "manual_resend";

@Injectable()
export class PlatformAdminBillingEmailService {
  constructor(
    @Inject(EMAIL_PROVIDER)
    private readonly emailProvider: IEmailProvider,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  async sendPaymentRequestEmail(input: {
    billingRequestId: string;
    attemptedByPlatformAdminId?: string | null;
    mode: DeliveryMode;
  }) {
    const clientRef = this.buildClientRef(
      "payment_request",
      input.billingRequestId,
      input.mode,
    );
    const existing = await this.findByClientRef(clientRef);
    if (existing) return existing;

    const context = await this.loadContext(input.billingRequestId);
    if (!this.featureFlags.manualBillingControlsEnabled()) {
      return this.persistDelivery({
        billingRequestId: input.billingRequestId,
        manualPaymentId: null,
        kind: "payment_request",
        recipientEmail: context.organization.billingContactEmail,
        status: "skipped_disabled",
        clientRef,
        failureReason: "Manual billing controls are disabled.",
        attemptedByPlatformAdminId:
          input.attemptedByPlatformAdminId ?? null,
      });
    }
    if (!context.organization.billingContactEmail) {
      return this.persistDelivery({
        billingRequestId: input.billingRequestId,
        manualPaymentId: null,
        kind: "payment_request",
        recipientEmail: null,
        status: "skipped_missing_recipient",
        clientRef,
        failureReason: "Billing contact email is missing.",
        attemptedByPlatformAdminId:
          input.attemptedByPlatformAdminId ?? null,
      });
    }

    const paymentInstructions = this.buildPaymentMethodText();
    const email = buildManualBillingPaymentRequestEmail({
      organizationName: context.organization.name,
      referenceNumber: context.request.referenceNumber,
      totalAmountPhp: context.request.totalAmountPhp,
      dueAt: context.request.dueAt,
      paymentInstructions,
      items: context.items,
    });
    const attachment = await buildManualBillingProFormaInvoiceAttachment({
      organizationName: context.organization.name,
      referenceNumber: context.request.referenceNumber,
      totalAmountPhp: context.request.totalAmountPhp,
      dueAt: context.request.dueAt,
      issuedAt: context.request.createdAt,
      paymentInstructions,
      items: context.items,
    });

    return this.sendAndPersist({
      billingRequestId: input.billingRequestId,
      manualPaymentId: null,
      kind: "payment_request",
      recipientEmail: context.organization.billingContactEmail,
      clientRef,
      attemptedByPlatformAdminId:
        input.attemptedByPlatformAdminId ?? null,
      subject: email.subject,
      body: email.body,
      attachments: [attachment],
    });
  }

  async sendPaymentAcknowledgmentEmail(input: {
    billingRequestId: string;
    manualPaymentId: string;
    attemptedByPlatformAdminId?: string | null;
    mode: DeliveryMode;
  }) {
    const clientRef = this.buildClientRef(
      "payment_acknowledgment",
      input.manualPaymentId,
      input.mode,
    );
    const existing = await this.findByClientRef(clientRef);
    if (existing) return existing;

    const context = await this.loadContext(
      input.billingRequestId,
      input.manualPaymentId,
    );
    if (!context.payment) {
      throw new NotFoundException("Manual payment not found.");
    }
    if (!this.featureFlags.manualBillingControlsEnabled()) {
      return this.persistDelivery({
        billingRequestId: input.billingRequestId,
        manualPaymentId: input.manualPaymentId,
        kind: "payment_acknowledgment",
        recipientEmail: context.organization.billingContactEmail,
        status: "skipped_disabled",
        clientRef,
        failureReason: "Manual billing controls are disabled.",
        attemptedByPlatformAdminId:
          input.attemptedByPlatformAdminId ?? null,
      });
    }
    if (!context.organization.billingContactEmail) {
      return this.persistDelivery({
        billingRequestId: input.billingRequestId,
        manualPaymentId: input.manualPaymentId,
        kind: "payment_acknowledgment",
        recipientEmail: null,
        status: "skipped_missing_recipient",
        clientRef,
        failureReason: "Billing contact email is missing.",
        attemptedByPlatformAdminId:
          input.attemptedByPlatformAdminId ?? null,
      });
    }

    const email = buildManualBillingPaymentAcknowledgmentEmail({
      organizationName: context.organization.name,
      referenceNumber: context.request.referenceNumber,
      verifiedAmountPhp: context.payment.amountPhp,
      paymentMethod: context.payment.method,
      items: context.items,
    });
    return this.sendAndPersist({
      billingRequestId: input.billingRequestId,
      manualPaymentId: input.manualPaymentId,
      kind: "payment_acknowledgment",
      recipientEmail: context.organization.billingContactEmail,
      clientRef,
      attemptedByPlatformAdminId:
        input.attemptedByPlatformAdminId ?? null,
      subject: email.subject,
      body: email.body,
    });
  }

  private async loadContext(
    billingRequestId: string,
    manualPaymentId?: string,
  ) {
    const db = getDb();
    const [request] = await db
      .select()
      .from(manualBillingRequests)
      .where(eq(manualBillingRequests.id, billingRequestId))
      .limit(1);
    if (!request) throw new NotFoundException("Billing request not found.");
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, request.organizationId))
      .limit(1);
    if (!organization) throw new NotFoundException("Organization not found.");
    const items = await db
      .select()
      .from(manualBillingRequestItems)
      .where(eq(manualBillingRequestItems.billingRequestId, request.id))
      .limit(100);
    const [payment] = manualPaymentId
      ? await db
          .select()
          .from(manualPayments)
          .where(eq(manualPayments.id, manualPaymentId))
          .limit(1)
      : [];

    return {
      request,
      organization,
      items: items as ManualBillingEmailItem[],
      payment,
    };
  }

  private async sendAndPersist(input: {
    billingRequestId: string;
    manualPaymentId: string | null;
    kind: ManualBillingEmailKind;
    recipientEmail: string;
    clientRef: string;
    attemptedByPlatformAdminId: string | null;
    subject: string;
    body: string;
    attachments?: Parameters<IEmailProvider["send"]>[0]["attachments"];
  }) {
    try {
      const result = await this.emailProvider.send({
        to: input.recipientEmail,
        subject: input.subject,
        body: input.body,
        clientRef: input.clientRef,
        ...(input.attachments ? { attachments: input.attachments } : {}),
      });
      if (result.ok) {
        return this.persistDelivery({
          ...input,
          status: "sent",
          providerMessageId: result.providerMessageId ?? null,
          failureReason: null,
          sentAt: new Date(),
        });
      }
      return this.persistDelivery({
        ...input,
        status: "failed",
        providerMessageId: null,
        failureReason: this.normalizeProviderFailure(result.errorCode),
      });
    } catch {
      return this.persistDelivery({
        ...input,
        status: "failed",
        providerMessageId: null,
        failureReason: "unexpected_provider_error",
      });
    }
  }

  private async persistDelivery(input: {
    billingRequestId: string;
    manualPaymentId: string | null;
    kind: ManualBillingEmailKind;
    recipientEmail: string | null;
    status: ManualBillingEmailDeliveryStatus;
    clientRef: string;
    providerMessageId?: string | null;
    failureReason?: string | null;
    attemptedByPlatformAdminId: string | null;
    sentAt?: Date | null;
  }) {
    const db = getDb();
    try {
      const [delivery] = await db
        .insert(manualBillingEmailDeliveries)
        .values({
          billingRequestId: input.billingRequestId,
          manualPaymentId: input.manualPaymentId,
          kind: input.kind,
          recipientEmail: input.recipientEmail,
          status: input.status,
          clientRef: input.clientRef,
          providerMessageId: input.providerMessageId ?? null,
          failureReason: input.failureReason ?? null,
          attemptedByPlatformAdminId: input.attemptedByPlatformAdminId,
          attemptedAt: new Date(),
          sentAt: input.sentAt ?? null,
          updatedAt: new Date(),
        })
        .returning();
      return this.serializeDelivery(delivery);
    } catch (error) {
      const existing = await this.findByClientRef(input.clientRef);
      if (existing) return existing;
      throw error;
    }
  }

  private async findByClientRef(clientRef: string) {
    const db = getDb();
    const [delivery] = await db
      .select()
      .from(manualBillingEmailDeliveries)
      .where(eq(manualBillingEmailDeliveries.clientRef, clientRef))
      .orderBy(desc(manualBillingEmailDeliveries.attemptedAt))
      .limit(1);
    return delivery ? this.serializeDelivery(delivery) : null;
  }

  private serializeDelivery(
    delivery: typeof manualBillingEmailDeliveries.$inferSelect,
  ) {
    return {
      ...delivery,
      attemptedAt:
        delivery.attemptedAt?.toISOString?.() ?? delivery.attemptedAt,
      sentAt: delivery.sentAt?.toISOString?.() ?? delivery.sentAt ?? null,
    };
  }

  private buildClientRef(
    kind: ManualBillingEmailKind,
    entityId: string,
    mode: DeliveryMode,
  ) {
    const prefix = `manual-billing-${kind.replace(/_/g, "-")}:${entityId}`;
    return mode === "automatic"
      ? `${prefix}:automatic`
      : `${prefix}:manual:${randomUUID()}`;
  }

  private normalizeProviderFailure(errorCode?: string) {
    if (
      errorCode === "provider_not_configured" ||
      errorCode === "provider_rejected" ||
      errorCode === "provider_transient"
    ) {
      return errorCode;
    }
    return "unexpected_provider_error";
  }

  private buildPaymentMethodText() {
    const gcashNumber = process.env.MANUAL_PAYMENT_GCASH_NUMBER?.trim();
    const gcashName = process.env.MANUAL_PAYMENT_GCASH_ACCOUNT_NAME?.trim();
    const bankName = process.env.MANUAL_PAYMENT_BANK_NAME?.trim();
    const bankAccountNumber =
      process.env.MANUAL_PAYMENT_BANK_ACCOUNT_NUMBER?.trim();
    const bankAccountName =
      process.env.MANUAL_PAYMENT_BANK_ACCOUNT_NAME?.trim();
    return [
      gcashNumber && gcashName
        ? `GCash: ${gcashNumber} (${gcashName})`
        : null,
      bankName && bankAccountNumber && bankAccountName
        ? `Bank transfer: ${bankName} ${bankAccountNumber} (${bankAccountName})`
        : null,
    ]
      .filter(Boolean)
      .join("\n") || "Use the payment account shared by Tyvera support.";
  }
}
