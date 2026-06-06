import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  creditReconciliationEvents,
  getDb,
  manualBillingFulfillments,
  manualBillingRequestItems,
  manualBillingRequests,
  manualPayments,
  organizations,
  platformAdminAuditLogs,
  smsAddons,
  smsCredits,
  smsUsageEvents,
  verifiedOnlineBookingAddons,
  verifiedOnlineBookingCredits,
  verifiedOnlineBookingUsageEvents,
} from "@tyvera/database";
import type {
  BillingAddonSku,
  ManualBillingRequestStatus,
  ManualPaymentMethod,
  PlatformAdminPermission,
} from "@tyvera/types";
import { and, desc, eq, ilike } from "drizzle-orm";
import { randomUUID } from "crypto";
import { BILLING_ADDON_CATALOG, resolveAddonSku } from "../billing/plan-catalog";
import { SmsAddonGrantService } from "../billing/sms-addon-grant.service";
import { VerifiedBookingAddonGrantService } from "../billing/verified-booking-addon-grant.service";
import type { ActivePlatformAdmin } from "./platform-admin.service";

type BillingTx = {
  select: ReturnType<typeof getDb>["select"];
  insert: ReturnType<typeof getDb>["insert"];
  update: ReturnType<typeof getDb>["update"];
};

interface CreateBillingRequestInput {
  organizationId: string;
  sku: BillingAddonSku;
  quantity: number;
  dueAt?: string | null;
  notes?: string | null;
}

interface RecordManualPaymentInput {
  method: ManualPaymentMethod;
  amountPhp: number;
  externalReference?: string | null;
  proofUrl?: string | null;
  notes?: string | null;
}

interface SmsAdjustmentInput {
  type: "promotional_grant" | "admin_correction";
  units: number;
  reason: string;
}

@Injectable()
export class PlatformAdminBillingService {
  constructor(
    private readonly smsAddonGrant: SmsAddonGrantService,
    private readonly verifiedBookingAddonGrant: VerifiedBookingAddonGrantService,
  ) {}

  async listOrganizations(input: { search?: string | null } = {}) {
    const db = getDb();
    const rows = input.search?.trim()
      ? await db
          .select()
          .from(organizations)
          .where(ilike(organizations.name, `%${input.search.trim()}%`))
          .orderBy(desc(organizations.createdAt))
          .limit(100)
      : await db
          .select()
          .from(organizations)
          .orderBy(desc(organizations.createdAt))
          .limit(100);

    const organizationsWithStatus = await Promise.all(
      rows.map(async (organization) => {
        const smsLedger = await this.getCurrentSmsLedger(
          db,
          organization.id,
        );
        const [latestRequest] = await db
          .select()
          .from(manualBillingRequests)
          .where(eq(manualBillingRequests.organizationId, organization.id))
          .orderBy(desc(manualBillingRequests.createdAt))
          .limit(1);

        return {
          id: organization.id,
          name: organization.name,
          currentPlan: organization.currentPlan ?? "free",
          billingStatus: organization.billingStatus ?? "free_active",
          smsRemaining: smsLedger
            ? Math.max(0, smsLedger.included + smsLedger.addon - smsLedger.used)
            : 0,
          latestManualBillingRequestStatus: latestRequest?.status ?? null,
        };
      }),
    );

    return { organizations: organizationsWithStatus };
  }

  async getOrganizationDetail(organizationId: string) {
    const db = getDb();
    const organization = await this.getOrganizationOrThrow(db, organizationId);
    const smsLedger = await this.getCurrentSmsLedger(db, organizationId);
    const verifiedBookingLedger = await this.getCurrentVerifiedLedger(
      db,
      organizationId,
    );
    const recentSmsAddons = await db
      .select()
      .from(smsAddons)
      .where(eq(smsAddons.organizationId, organizationId))
      .orderBy(desc(smsAddons.createdAt))
      .limit(10);
    const recentSmsUsage = await db
      .select()
      .from(smsUsageEvents)
      .where(eq(smsUsageEvents.organizationId, organizationId))
      .orderBy(desc(smsUsageEvents.createdAt))
      .limit(10);
    const recentBookingAddons = await db
      .select()
      .from(verifiedOnlineBookingAddons)
      .where(eq(verifiedOnlineBookingAddons.organizationId, organizationId))
      .orderBy(desc(verifiedOnlineBookingAddons.createdAt))
      .limit(10);
    const recentBookingUsage = await db
      .select()
      .from(verifiedOnlineBookingUsageEvents)
      .where(eq(verifiedOnlineBookingUsageEvents.organizationId, organizationId))
      .orderBy(desc(verifiedOnlineBookingUsageEvents.createdAt))
      .limit(10);
    const billingRequests = await db
      .select()
      .from(manualBillingRequests)
      .where(eq(manualBillingRequests.organizationId, organizationId))
      .orderBy(desc(manualBillingRequests.createdAt))
      .limit(10);
    const reconciliation = await db
      .select()
      .from(creditReconciliationEvents)
      .where(eq(creditReconciliationEvents.organizationId, organizationId))
      .orderBy(desc(creditReconciliationEvents.createdAt))
      .limit(20);

    return {
      organization,
      smsLedger: this.serializeSmsLedger(smsLedger),
      verifiedBookingLedger: this.serializeVerifiedLedger(verifiedBookingLedger),
      recentSmsAddons,
      recentSmsUsage,
      recentBookingAddons,
      recentBookingUsage,
      billingRequests,
      payments: await this.listPaymentsForRequests(db, billingRequests),
      reconciliation,
    };
  }

  async getSmsLedger(organizationId: string) {
    const db = getDb();
    await this.getOrganizationOrThrow(db, organizationId);
    return { smsLedger: this.serializeSmsLedger(await this.getCurrentSmsLedger(db, organizationId)) };
  }

  listAddons() {
    return { addons: BILLING_ADDON_CATALOG };
  }

  async listBillingRequests(input: {
    status?: ManualBillingRequestStatus | "all" | null;
  } = {}) {
    const db = getDb();
    const rows =
      input.status && input.status !== "all"
        ? await db
            .select()
            .from(manualBillingRequests)
            .where(eq(manualBillingRequests.status, input.status))
            .orderBy(desc(manualBillingRequests.createdAt))
            .limit(100)
        : await db
            .select()
            .from(manualBillingRequests)
            .orderBy(desc(manualBillingRequests.createdAt))
            .limit(100);

    const billingRequests = await Promise.all(
      rows.map(async (request) => {
        const [organization] = await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, request.organizationId))
          .limit(1);
        const [item] = await db
          .select()
          .from(manualBillingRequestItems)
          .where(eq(manualBillingRequestItems.billingRequestId, request.id))
          .limit(1);

        return {
          id: request.id,
          referenceNumber: request.referenceNumber,
          organizationId: request.organizationId,
          organizationName: organization?.name ?? "Unknown organization",
          status: request.status,
          totalAmountPhp: request.totalAmountPhp,
          dueAt: request.dueAt?.toISOString?.() ?? request.dueAt ?? null,
          createdAt: request.createdAt?.toISOString?.() ?? request.createdAt,
          itemSummary: item?.sku ?? "Manual billing request",
        };
      }),
    );

    return { billingRequests };
  }

  async createBillingRequest(
    actor: ActivePlatformAdmin,
    input: CreateBillingRequestInput,
  ) {
    this.ensurePermission(actor, "BILLING_REQUEST_CREATE");
    const addon = resolveAddonSku(input.sku);
    const quantity = Number(input.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException("Quantity must be a positive integer.");
    }

    const db = getDb();
    return db.transaction(async (tx) => {
      const organization = await this.getOrganizationOrThrow(
        tx,
        input.organizationId,
      );
      const referenceNumber = await this.generateReferenceNumber(tx);
      const totalAmountPhp = addon.pricePhp * quantity;
      const [request] = await tx
        .insert(manualBillingRequests)
        .values({
          organizationId: input.organizationId,
          referenceNumber,
          status: "awaiting_payment",
          totalAmountPhp,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
          notes: input.notes ?? null,
          createdByPlatformAdminId: actor.id,
          updatedAt: new Date(),
        })
        .returning();

      await tx.insert(manualBillingRequestItems).values({
        billingRequestId: request.id,
        sku: addon.sku,
        purchaseKind: addon.purchaseKind,
        units: addon.units,
        unitPricePhp: addon.pricePhp,
        quantity,
        totalAmountPhp,
      }).returning();

      await this.writeAudit(tx, actor, {
        organizationId: input.organizationId,
        action: "manual_billing_request.created",
        entity: "manual_billing_request",
        entityId: request.id,
        details: {
          referenceNumber,
          sku: addon.sku,
          quantity,
          totalAmountPhp,
        },
      });

      return {
        billingRequest: await this.serializeBillingRequest(tx, request.id),
        paymentInstructions: this.buildPaymentInstructions({
          businessName: organization.name,
          sku: addon.sku,
          amountPhp: totalAmountPhp,
          referenceNumber,
        }),
      };
    });
  }

  async getBillingRequest(billingRequestId: string) {
    return this.serializeBillingRequest(getDb(), billingRequestId);
  }

  async recordManualPayment(
    actor: ActivePlatformAdmin,
    billingRequestId: string,
    input: RecordManualPaymentInput,
  ) {
    this.ensurePermission(actor, "PAYMENT_RECORD");
    if (!["gcash", "bank_transfer", "other"].includes(input.method)) {
      throw new BadRequestException("Invalid manual payment method.");
    }
    if (!Number.isInteger(input.amountPhp) || input.amountPhp <= 0) {
      throw new BadRequestException("Amount must be a positive PHP integer.");
    }

    const db = getDb();
    return db.transaction(async (tx) => {
      const request = await this.getBillingRequestOrThrow(tx, billingRequestId);
      if (
        request.status !== "awaiting_payment" &&
        request.status !== "payment_reported"
      ) {
        throw new ConflictException({
          code: "INVALID_REQUEST_STATUS",
          status: request.status,
        });
      }

      const [payment] = await tx
        .insert(manualPayments)
        .values({
          billingRequestId,
          method: input.method,
          amountPhp: input.amountPhp,
          status: "pending",
          externalReference: input.externalReference ?? null,
          proofUrl: input.proofUrl ?? null,
          notes: input.notes ?? null,
          recordedByPlatformAdminId: actor.id,
          updatedAt: new Date(),
        })
        .returning();

      await tx
        .update(manualBillingRequests)
        .set({ status: "payment_reported", updatedAt: new Date() })
        .where(eq(manualBillingRequests.id, billingRequestId));

      await this.writeAudit(tx, actor, {
        organizationId: request.organizationId,
        action: "manual_payment.recorded",
        entity: "manual_payment",
        entityId: payment.id,
        details: {
          billingRequestId,
          amountPhp: input.amountPhp,
          method: input.method,
        },
      });

      return this.serializeBillingRequest(tx, billingRequestId);
    });
  }

  async confirmAndFulfillManualPayment(
    actor: ActivePlatformAdmin,
    paymentId: string,
  ) {
    this.ensurePermission(actor, "PAYMENT_VERIFY");
    const db = getDb();

    return db.transaction(async (tx) => {
      const payment = await this.getManualPaymentOrThrow(tx, paymentId);
      if (payment.status !== "pending") {
        throw new ConflictException({
          code: "INVALID_REQUEST_STATUS",
          status: payment.status,
        });
      }

      const request = await this.getBillingRequestOrThrow(
        tx,
        payment.billingRequestId,
      );
      if (request.status === "paid_and_fulfilled") {
        throw new ConflictException({ code: "ALREADY_FULFILLED" });
      }
      if (
        request.status !== "payment_reported" &&
        request.status !== "awaiting_payment"
      ) {
        throw new ConflictException({
          code: "INVALID_REQUEST_STATUS",
          status: request.status,
        });
      }
      if (payment.amountPhp !== request.totalAmountPhp) {
        throw new BadRequestException({
          code: "PAYMENT_AMOUNT_MISMATCH",
          expectedAmountPhp: request.totalAmountPhp,
          receivedAmountPhp: payment.amountPhp,
        });
      }

      const items = await tx
        .select()
        .from(manualBillingRequestItems)
        .where(eq(manualBillingRequestItems.billingRequestId, request.id))
        .limit(100);
      if (items.length === 0) {
        throw new ConflictException("Billing request has no items.");
      }

      for (const item of items) {
        const [existingFulfillment] = await tx
          .select()
          .from(manualBillingFulfillments)
          .where(eq(manualBillingFulfillments.billingRequestItemId, item.id))
          .limit(1);
        if (existingFulfillment) {
          throw new ConflictException({ code: "ALREADY_FULFILLED" });
        }
      }

      for (const item of items) {
        const units = item.units * item.quantity;
        const sourceReference = `manual-payment:${payment.id}:${item.id}`;
        if (item.purchaseKind === "sms_segment_topup") {
          await this.smsAddonGrant.grant(
            {
              organizationId: request.organizationId,
              units,
              pricePhp: item.totalAmountPhp,
              source: "manual_payment",
              sourceReference,
              purchasedByUserId: actor.userId,
              metadata: {
                billingRequestId: request.id,
                billingRequestItemId: item.id,
                manualPaymentId: payment.id,
              },
            },
            tx,
          );
        } else if (item.purchaseKind === "online_booking_topup") {
          await this.verifiedBookingAddonGrant.grant(
            {
              organizationId: request.organizationId,
              units,
              pricePhp: item.totalAmountPhp,
              sku: item.sku as BillingAddonSku,
              source: "manual_payment",
              sourceReference,
              purchasedByUserId: actor.userId,
              metadata: {
                billingRequestId: request.id,
                billingRequestItemId: item.id,
                manualPaymentId: payment.id,
              },
            },
            tx,
          );
        } else {
          throw new BadRequestException("Unsupported billing item.");
        }

        await tx.insert(manualBillingFulfillments).values({
          billingRequestItemId: item.id,
          manualPaymentId: payment.id,
          organizationId: request.organizationId,
          purchaseKind: item.purchaseKind,
          units,
          source: "manual_payment",
          sourceReference,
          fulfilledByPlatformAdminId: actor.id,
        }).returning();
      }

      await tx
        .update(manualPayments)
        .set({
          status: "verified",
          verifiedByPlatformAdminId: actor.id,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(manualPayments.id, payment.id));

      await tx
        .update(manualBillingRequests)
        .set({
          status: "paid_and_fulfilled",
          updatedAt: new Date(),
        })
        .where(eq(manualBillingRequests.id, request.id));

      await this.writeAudit(tx, actor, {
        organizationId: request.organizationId,
        action: "manual_payment.confirmed_and_fulfilled",
        entity: "manual_payment",
        entityId: payment.id,
        details: {
          billingRequestId: request.id,
          amountPhp: payment.amountPhp,
        },
      });

      return this.serializeBillingRequest(tx, request.id);
    });
  }

  async rejectManualPayment(actor: ActivePlatformAdmin, paymentId: string) {
    this.ensurePermission(actor, "PAYMENT_REJECT");
    const db = getDb();
    return db.transaction(async (tx) => {
      const payment = await this.getManualPaymentOrThrow(tx, paymentId);
      const request = await this.getBillingRequestOrThrow(
        tx,
        payment.billingRequestId,
      );
      if (payment.status !== "pending") {
        throw new ConflictException({
          code: "INVALID_REQUEST_STATUS",
          status: payment.status,
        });
      }

      await tx
        .update(manualPayments)
        .set({
          status: "rejected",
          rejectedByPlatformAdminId: actor.id,
          rejectedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(manualPayments.id, payment.id));
      await tx
        .update(manualBillingRequests)
        .set({ status: "rejected", updatedAt: new Date() })
        .where(eq(manualBillingRequests.id, request.id));

      await this.writeAudit(tx, actor, {
        organizationId: request.organizationId,
        action: "manual_payment.rejected",
        entity: "manual_payment",
        entityId: payment.id,
        details: { billingRequestId: request.id },
      });

      return this.serializeBillingRequest(tx, request.id);
    });
  }

  async voidBillingRequest(
    actor: ActivePlatformAdmin,
    billingRequestId: string,
  ) {
    this.ensurePermission(actor, "BILLING_REQUEST_VOID");
    const db = getDb();
    return db.transaction(async (tx) => {
      const request = await this.getBillingRequestOrThrow(tx, billingRequestId);
      if (request.status === "paid_and_fulfilled") {
        throw new ConflictException({ code: "ALREADY_FULFILLED" });
      }

      await tx
        .update(manualBillingRequests)
        .set({
          status: "void",
          voidedByPlatformAdminId: actor.id,
          voidedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(manualBillingRequests.id, billingRequestId));

      await this.writeAudit(tx, actor, {
        organizationId: request.organizationId,
        action: "manual_billing_request.voided",
        entity: "manual_billing_request",
        entityId: billingRequestId,
        details: { referenceNumber: request.referenceNumber },
      });

      return this.serializeBillingRequest(tx, billingRequestId);
    });
  }

  async adjustSmsCredits(
    actor: ActivePlatformAdmin,
    organizationId: string,
    input: SmsAdjustmentInput,
  ) {
    if (input.type === "promotional_grant") {
      this.ensurePermission(actor, "SMS_CREDIT_GRANT_PROMOTIONAL");
      if (input.units <= 0) {
        throw new BadRequestException("Promotional grants must be positive.");
      }
    } else {
      this.ensurePermission(actor, "SMS_CREDIT_APPLY_CORRECTION");
    }
    if (!input.reason?.trim()) {
      throw new BadRequestException("Reason is required.");
    }
    if (!Number.isInteger(input.units) || input.units === 0) {
      throw new BadRequestException("Units must be a non-zero integer.");
    }

    const db = getDb();
    return db.transaction(async (tx) => {
      await this.getOrganizationOrThrow(tx, organizationId);
      const ledger = await this.getCurrentSmsLedger(tx, organizationId);
      const remaining = ledger
        ? Math.max(0, ledger.included + ledger.addon - ledger.used)
        : 0;
      if (input.type === "admin_correction" && input.units < 0) {
        if (remaining + input.units < 0) {
          throw new BadRequestException({
            code: "INSUFFICIENT_REMAINING_CREDITS",
            remainingCredits: remaining,
            requestedUnits: input.units,
          });
        }
      }

      const sourceReference = `admin-adjustment:${randomUUID()}`;
      await this.smsAddonGrant.grant(
        {
          organizationId,
          units: input.units,
          pricePhp: 0,
          source: "admin_adjustment",
          sourceReference,
          purchasedByUserId: actor.userId,
          metadata: {
            adjustmentType: input.type,
            reason: input.reason.trim(),
            platformAdminId: actor.id,
          },
        },
        tx,
      );

      await this.writeAudit(tx, actor, {
        organizationId,
        action: `sms_credit.${input.type}`,
        entity: "sms_credit",
        entityId: null,
        details: {
          units: input.units,
          reason: input.reason.trim(),
          sourceReference,
        },
      });

      return { smsLedger: this.serializeSmsLedger(await this.getCurrentSmsLedger(tx, organizationId)) };
    });
  }

  async listAuditLogs() {
    const db = getDb();
    const rows = await db
      .select()
      .from(platformAdminAuditLogs)
      .orderBy(desc(platformAdminAuditLogs.createdAt))
      .limit(100);
    return { auditLogs: rows };
  }

  private ensurePermission(
    actor: ActivePlatformAdmin,
    permission: PlatformAdminPermission,
  ) {
    if (!actor.permissions.has(permission)) {
      throw new ForbiddenException("Insufficient permission");
    }
  }

  private async getOrganizationOrThrow(tx: BillingTx, organizationId: string) {
    const [organization] = await tx
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    if (!organization) {
      throw new NotFoundException("Organization not found.");
    }
    return organization;
  }

  private async getBillingRequestOrThrow(
    tx: BillingTx,
    billingRequestId: string,
  ) {
    const [request] = await tx
      .select()
      .from(manualBillingRequests)
      .where(eq(manualBillingRequests.id, billingRequestId))
      .limit(1);
    if (!request) {
      throw new NotFoundException("Billing request not found.");
    }
    return request;
  }

  private async getManualPaymentOrThrow(tx: BillingTx, paymentId: string) {
    const [payment] = await tx
      .select()
      .from(manualPayments)
      .where(eq(manualPayments.id, paymentId))
      .limit(1);
    if (!payment) {
      throw new NotFoundException("Manual payment not found.");
    }
    return payment;
  }

  private async serializeBillingRequest(tx: BillingTx, billingRequestId: string) {
    const request = await this.getBillingRequestOrThrow(tx, billingRequestId);
    const organization = await this.getOrganizationOrThrow(
      tx,
      request.organizationId,
    );
    const items = await tx
      .select()
      .from(manualBillingRequestItems)
      .where(eq(manualBillingRequestItems.billingRequestId, request.id))
      .limit(100);
    const payments = await tx
      .select()
      .from(manualPayments)
      .where(eq(manualPayments.billingRequestId, request.id))
      .limit(100);
    const fulfillments = await Promise.all(
      items.map(async (item) => {
        const [fulfillment] = await tx
          .select()
          .from(manualBillingFulfillments)
          .where(eq(manualBillingFulfillments.billingRequestItemId, item.id))
          .limit(1);
        return fulfillment;
      }),
    );
    const auditLogs = await tx
      .select()
      .from(platformAdminAuditLogs)
      .where(eq(platformAdminAuditLogs.organizationId, request.organizationId))
      .limit(50);

    return {
      id: request.id,
      referenceNumber: request.referenceNumber,
      organizationId: request.organizationId,
      organizationName: organization.name,
      status: request.status,
      totalAmountPhp: request.totalAmountPhp,
      dueAt: request.dueAt?.toISOString?.() ?? request.dueAt ?? null,
      createdAt: request.createdAt?.toISOString?.() ?? request.createdAt,
      notes: request.notes ?? null,
      items,
      payments,
      fulfillments: fulfillments.filter(Boolean),
      auditLogs,
      paymentInstructions: this.buildPaymentInstructions({
        businessName: organization.name,
        sku: items[0]?.sku ?? "Manual top-up",
        amountPhp: request.totalAmountPhp,
        referenceNumber: request.referenceNumber,
      }),
    };
  }

  private async generateReferenceNumber(tx: BillingTx) {
    const year = new Date().getUTCFullYear();
    const [latest] = await tx
      .select()
      .from(manualBillingRequests)
      .orderBy(desc(manualBillingRequests.createdAt))
      .limit(1);
    const latestReference =
      typeof latest?.referenceNumber === "string" ? latest.referenceNumber : "";
    const match = latestReference.match(/^TYV-(\d{4})-(\d{6})$/);
    const next =
      match && Number(match[1]) === year ? Number(match[2]) + 1 : 1;
    return `TYV-${year}-${String(next).padStart(6, "0")}`;
  }

  private buildPaymentInstructions(input: {
    businessName: string;
    sku: string;
    amountPhp: number;
    referenceNumber: string;
  }) {
    const gcashNumber = process.env.MANUAL_PAYMENT_GCASH_NUMBER?.trim();
    const gcashName = process.env.MANUAL_PAYMENT_GCASH_ACCOUNT_NAME?.trim();
    const bankName = process.env.MANUAL_PAYMENT_BANK_NAME?.trim();
    const bankAccountNumber =
      process.env.MANUAL_PAYMENT_BANK_ACCOUNT_NUMBER?.trim();
    const bankAccountName =
      process.env.MANUAL_PAYMENT_BANK_ACCOUNT_NAME?.trim();
    const paymentMethodLines = [
      gcashNumber && gcashName
        ? `GCash: ${gcashNumber} (${gcashName})`
        : null,
      bankName && bankAccountNumber && bankAccountName
        ? `Bank transfer: ${bankName} ${bankAccountNumber} (${bankAccountName})`
        : null,
    ].filter(Boolean);

    const copyText = [
      `Hi ${input.businessName},`,
      "Your Tyvera top-up request is ready.",
      `Package: ${input.sku}`,
      `Amount: ${this.formatPhp(input.amountPhp)}`,
      `Reference: ${input.referenceNumber}`,
      "Payment method:",
      paymentMethodLines.join("\n") || "Use the payment account shared by Tyvera support.",
      "After payment, please send your transaction reference number so we can apply your credits.",
    ].join("\n");

    return {
      copyText,
      gcashConfigured: Boolean(gcashNumber && gcashName),
      bankConfigured: Boolean(bankName && bankAccountNumber && bankAccountName),
    };
  }

  private formatPhp(amountPhp: number) {
    return `₱${new Intl.NumberFormat("en-PH").format(amountPhp)}`;
  }

  private async writeAudit(
    tx: BillingTx,
    actor: ActivePlatformAdmin,
    input: {
      organizationId: string | null;
      action: string;
      entity: string;
      entityId: string | null;
      details?: Record<string, unknown>;
    },
  ) {
    await tx.insert(platformAdminAuditLogs).values({
      actorPlatformAdminId: actor.id,
      actorUserId: actor.userId,
      organizationId: input.organizationId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      details: input.details ?? null,
    });
  }

  private async getCurrentSmsLedger(tx: BillingTx, organizationId: string) {
    const [ledger] = await tx
      .select()
      .from(smsCredits)
      .where(
        and(
          eq(smsCredits.organizationId, organizationId),
          eq(smsCredits.month, this.currentMonthKey()),
        ),
      )
      .limit(1);
    return ledger ?? null;
  }

  private async getCurrentVerifiedLedger(tx: BillingTx, organizationId: string) {
    const [ledger] = await tx
      .select()
      .from(verifiedOnlineBookingCredits)
      .where(
        and(
          eq(verifiedOnlineBookingCredits.organizationId, organizationId),
          eq(verifiedOnlineBookingCredits.month, this.currentMonthKey()),
        ),
      )
      .limit(1);
    return ledger ?? null;
  }

  private serializeSmsLedger(
    ledger: {
      included: number;
      addon: number;
      used: number;
      month: string;
    } | null,
  ) {
    if (!ledger) {
      return {
        month: this.currentMonthKey(),
        included: 0,
        addon: 0,
        used: 0,
        total: 0,
        remaining: 0,
      };
    }
    return {
      month: ledger.month,
      included: ledger.included,
      addon: ledger.addon,
      used: ledger.used,
      total: ledger.included + ledger.addon,
      remaining: Math.max(0, ledger.included + ledger.addon - ledger.used),
    };
  }

  private serializeVerifiedLedger(
    ledger: {
      includedGranted: number;
      addonGranted: number;
      used: number;
      month: string;
    } | null,
  ) {
    if (!ledger) {
      return {
        month: this.currentMonthKey(),
        included: 0,
        addon: 0,
        used: 0,
        total: 0,
        remaining: 0,
      };
    }
    return {
      month: ledger.month,
      included: ledger.includedGranted,
      addon: ledger.addonGranted,
      used: ledger.used,
      total: ledger.includedGranted + ledger.addonGranted,
      remaining: Math.max(
        0,
        ledger.includedGranted + ledger.addonGranted - ledger.used,
      ),
    };
  }

  private async listPaymentsForRequests(
    tx: BillingTx,
    requests: Array<{ id: string }>,
  ) {
    const payments = [];
    for (const request of requests) {
      const requestPayments = await tx
        .select()
        .from(manualPayments)
        .where(eq(manualPayments.billingRequestId, request.id))
        .limit(20);
      payments.push(...requestPayments);
    }
    return payments;
  }

  private currentMonthKey(date = new Date()) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }
}
