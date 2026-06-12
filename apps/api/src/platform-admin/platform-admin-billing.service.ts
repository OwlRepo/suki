import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  creditReconciliationEvents,
  getDb,
  manualBillingEmailDeliveries,
  manualBillingFulfillments,
  manualBillingRequestItems,
  manualBillingRequests,
  manualPayments,
  organizations,
  platformAdminAuditLogs,
  smsAddons,
  smsCredits,
  smsUsageEvents,
  subscriptions,
  verifiedOnlineBookingAddons,
  verifiedOnlineBookingCredits,
  verifiedOnlineBookingUsageEvents,
} from "@tyvera/database";
import type {
  BillingAddonSku,
  ManualBillingSku,
  ManualBillingRequestStatus,
  ManualPaymentMethod,
  ManualSubscriptionAction,
  OrgBillingStatus,
  PlatformAdminPermission,
  PlanType,
} from "@tyvera/types";
import {
  PH_MOBILE_E164_ERROR,
  isValidPhilippineMobileE164,
} from "@tyvera/types";
import { and, desc, eq, ilike } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  BILLING_ADDON_CATALOG,
  MANUAL_BILLING_CATALOG,
  getPlanCatalogEntry,
  resolveManualBillingSku,
} from "../billing/plan-catalog";
import { SmsAddonGrantService } from "../billing/sms-addon-grant.service";
import { VerifiedBookingAddonGrantService } from "../billing/verified-booking-addon-grant.service";
import { FeatureFlagsService } from "../common/feature-flags.service";
import {
  assertManualSubscriptionActionAllowed,
  isPaidManualPlan,
  resolveManualCoveragePeriod,
} from "./manual-subscription-policy";
import type { ActivePlatformAdmin } from "./platform-admin.service";
import { PlatformAdminBillingEmailService } from "./platform-admin-billing-email.service";

type BillingTx = {
  select: ReturnType<typeof getDb>["select"];
  insert: ReturnType<typeof getDb>["insert"];
  update: ReturnType<typeof getDb>["update"];
};

interface CreateBillingRequestInput {
  organizationId: string;
  sku: ManualBillingSku;
  quantity: number;
  dueAt?: string | null;
  notes?: string | null;
  coverageStartsAt?: string | null;
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

interface UpdateBillingContactInput {
  billingContactName?: string | null;
  billingContactMobile?: string | null;
  billingContactEmail?: string | null;
  preferredPaymentMethod?: ManualPaymentMethod | null;
}

interface UpdateManualSubscriptionStatusInput {
  action: ManualSubscriptionAction;
  graceUntil?: string | null;
  reason: string;
}

@Injectable()
export class PlatformAdminBillingService {
  constructor(
    private readonly smsAddonGrant: SmsAddonGrantService,
    private readonly verifiedBookingAddonGrant: VerifiedBookingAddonGrantService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly billingEmails: PlatformAdminBillingEmailService,
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
      manualBillingControlsEnabled:
        this.featureFlags.manualBillingControlsEnabled(),
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

  listManualBillingCatalog() {
    return {
      manualBillingControlsEnabled:
        this.featureFlags.manualBillingControlsEnabled(),
      items: MANUAL_BILLING_CATALOG,
    };
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
    this.ensureManualBillingControlsEnabled();
    const catalogItem = resolveManualBillingSku(input.sku);
    const quantity = Number(input.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException("Quantity must be a positive integer.");
    }
    if (catalogItem.purchaseKind === "subscription" && quantity !== 1) {
      throw new BadRequestException(
        "Manual subscription quantity must equal one.",
      );
    }

    const db = getDb();
    const created = await db.transaction(async (tx) => {
      const organization = await this.getOrganizationOrThrow(
        tx,
        input.organizationId,
      );
      if (catalogItem.purchaseKind === "subscription") {
        this.ensureSubscriptionRequestPermission(actor, organization, {
          planType: catalogItem.planType,
        });
      } else {
        this.ensurePermission(actor, "BILLING_REQUEST_CREATE");
      }
      const referenceNumber = await this.generateReferenceNumber(tx);
      const totalAmountPhp = catalogItem.pricePhp * quantity;
      const coverage =
        catalogItem.purchaseKind === "subscription"
          ? resolveManualCoveragePeriod({
              now: input.coverageStartsAt
                ? this.parseRequiredDate(
                    input.coverageStartsAt,
                    "Invalid coverage start date.",
                  )
                : new Date(),
              currentAccessEndsAt: input.coverageStartsAt
                ? null
                : organization.accessEndsAt,
              billingInterval: catalogItem.billingInterval,
            })
          : null;
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
        sku: catalogItem.sku,
        purchaseKind: catalogItem.purchaseKind,
        units:
          catalogItem.purchaseKind === "subscription" ? 1 : catalogItem.units,
        unitPricePhp: catalogItem.pricePhp,
        quantity,
        totalAmountPhp,
        planType:
          catalogItem.purchaseKind === "subscription"
            ? catalogItem.planType
            : null,
        billingInterval:
          catalogItem.purchaseKind === "subscription"
            ? catalogItem.billingInterval
            : null,
        coverageStartsAt: coverage?.startAt ?? null,
        coverageEndsAt: coverage?.endAt ?? null,
      }).returning();

      await this.writeAudit(tx, actor, {
        organizationId: input.organizationId,
        action: "manual_billing_request.created",
        entity: "manual_billing_request",
        entityId: request.id,
        details: {
          referenceNumber,
          sku: catalogItem.sku,
          quantity,
          totalAmountPhp,
          coverageStartsAt: coverage?.startAt.toISOString() ?? null,
          coverageEndsAt: coverage?.endAt.toISOString() ?? null,
        },
      });

      return {
        billingRequest: await this.serializeBillingRequest(tx, request.id),
        paymentInstructions: this.buildPaymentInstructions({
          businessName: organization.name,
          sku: catalogItem.sku,
          purchaseKind: catalogItem.purchaseKind,
          amountPhp: totalAmountPhp,
          referenceNumber,
        }),
      };
    });
    const emailDelivery = await this.sendAutomaticPaymentRequestEmail(
      actor,
      created.billingRequest.id,
    );
    return {
      ...created,
      billingRequest: this.withLatestDelivery(
        created.billingRequest,
        emailDelivery,
      ),
      emailDelivery,
    };
  }

  async getBillingRequest(billingRequestId: string) {
    return this.serializeBillingRequest(getDb(), billingRequestId);
  }

  async recordManualPayment(
    actor: ActivePlatformAdmin,
    billingRequestId: string,
    input: RecordManualPaymentInput,
  ) {
    this.ensureManualBillingControlsEnabled();
    this.ensurePermission(actor, "PAYMENT_RECORD");
    if (!["gcash", "bank_transfer", "other"].includes(input.method)) {
      throw new BadRequestException("Invalid manual payment method.");
    }
    if (!Number.isInteger(input.amountPhp) || input.amountPhp <= 0) {
      throw new BadRequestException("Amount must be a positive PHP integer.");
    }

    const db = getDb();
    const fulfilled = await db.transaction(async (tx) => {
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
    this.ensureManualBillingControlsEnabled();
    this.ensurePermission(actor, "PAYMENT_VERIFY");
    const db = getDb();

    const fulfilled = await db.transaction(async (tx) => {
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
        } else if (item.purchaseKind === "subscription") {
          await this.fulfillManualSubscription(tx, actor, {
            request,
            item,
            payment,
          });
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
    const latestEmailDelivery =
      await this.sendAutomaticPaymentAcknowledgmentEmail(
        actor,
        fulfilled.id,
        paymentId,
      );
    return {
      ...this.withLatestDelivery(fulfilled, latestEmailDelivery),
      latestEmailDelivery,
    };
  }

  async sendPaymentRequestEmail(
    actor: ActivePlatformAdmin,
    billingRequestId: string,
  ) {
    this.ensureManualBillingControlsEnabled();
    this.ensurePermission(actor, "BILLING_REQUEST_CREATE");
    await this.getBillingRequestOrThrow(getDb(), billingRequestId);
    return this.billingEmails.sendPaymentRequestEmail({
      billingRequestId,
      attemptedByPlatformAdminId: actor.id,
      mode: "manual_resend",
    });
  }

  async sendPaymentAcknowledgmentEmail(
    actor: ActivePlatformAdmin,
    billingRequestId: string,
  ) {
    this.ensureManualBillingControlsEnabled();
    this.ensurePermission(actor, "PAYMENT_VERIFY");
    const detail = await this.serializeBillingRequest(
      getDb(),
      billingRequestId,
    );
    const payment = detail.payments.find(
      (candidate) => candidate.status === "verified",
    );
    if (!payment) {
      throw new ConflictException("No verified payment is available.");
    }
    return this.billingEmails.sendPaymentAcknowledgmentEmail({
      billingRequestId,
      manualPaymentId: payment.id,
      attemptedByPlatformAdminId: actor.id,
      mode: "manual_resend",
    });
  }

  async rejectManualPayment(actor: ActivePlatformAdmin, paymentId: string) {
    this.ensureManualBillingControlsEnabled();
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
    this.ensureManualBillingControlsEnabled();
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
    this.ensureManualBillingControlsEnabled();
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

  async updateOrganizationBillingContact(
    actor: ActivePlatformAdmin,
    organizationId: string,
    input: UpdateBillingContactInput,
  ) {
    this.ensureManualBillingControlsEnabled();
    this.ensurePermission(actor, "BUSINESS_UPDATE");
    const billingContactMobile = input.billingContactMobile?.trim() || null;
    if (
      billingContactMobile &&
      !isValidPhilippineMobileE164(billingContactMobile)
    ) {
      throw new BadRequestException(PH_MOBILE_E164_ERROR);
    }
    if (
      input.preferredPaymentMethod != null &&
      !["gcash", "bank_transfer", "other"].includes(
        input.preferredPaymentMethod,
      )
    ) {
      throw new BadRequestException("Invalid preferred payment method.");
    }

    const db = getDb();
    return db.transaction(async (tx) => {
      await this.getOrganizationOrThrow(tx, organizationId);
      const updates = {
        billingContactName: input.billingContactName?.trim() || null,
        billingContactMobile,
        billingContactEmail: input.billingContactEmail?.trim() || null,
        preferredPaymentMethod: input.preferredPaymentMethod ?? null,
        updatedAt: new Date(),
      };
      await tx
        .update(organizations)
        .set(updates)
        .where(eq(organizations.id, organizationId));
      await this.writeAudit(tx, actor, {
        organizationId,
        action: "organization.billing_contact.updated",
        entity: "organization",
        entityId: organizationId,
        details: {
          billingContactName: updates.billingContactName,
          billingContactMobile: updates.billingContactMobile,
          billingContactEmail: updates.billingContactEmail,
          preferredPaymentMethod: updates.preferredPaymentMethod,
        },
      });
      return {
        organization: await this.getOrganizationOrThrow(tx, organizationId),
      };
    });
  }

  async updateManualSubscriptionStatus(
    actor: ActivePlatformAdmin,
    organizationId: string,
    input: UpdateManualSubscriptionStatusInput,
  ) {
    this.ensureManualBillingControlsEnabled();
    if (!input.reason?.trim()) {
      throw new BadRequestException("Reason is required.");
    }
    this.ensurePermission(actor, this.permissionForAction(input.action));

    const db = getDb();
    return db.transaction(async (tx) => {
      const organization = await this.getOrganizationOrThrow(tx, organizationId);
      try {
        assertManualSubscriptionActionAllowed(
          organization.billingStatus as OrgBillingStatus | null,
          input.action,
        );
      } catch (error) {
        throw new ConflictException({
          code: "INVALID_SUBSCRIPTION_TRANSITION",
          message: error instanceof Error ? error.message : "Invalid transition.",
        });
      }

      const subscription = await this.getLatestSubscription(tx, organizationId);
      if (subscription?.provider === "lemonsqueezy") {
        throw new ConflictException({
          code: "PROVIDER_MANAGED_SUBSCRIPTION",
          message: "Use provider-managed billing controls for this subscription.",
        });
      }
      if (!subscription || subscription.provider !== "manual") {
        throw new ConflictException({
          code: "MANUAL_SUBSCRIPTION_NOT_FOUND",
        });
      }

      const now = new Date();
      const graceUntil =
        input.action === "set_grace_until"
          ? this.parseRequiredDate(
              input.graceUntil,
              "A valid grace-until date is required.",
            )
          : null;
      if (graceUntil && graceUntil.getTime() <= now.getTime()) {
        throw new BadRequestException(
          "Grace-until date must be in the future.",
        );
      }
      if (
        input.action === "reactivate" &&
        (!organization.accessEndsAt ||
          organization.accessEndsAt.getTime() <= now.getTime())
      ) {
        throw new ConflictException({
          code: "RENEWAL_REQUIRED",
          message: "Renew the subscription before reactivation.",
        });
      }

      const organizationUpdates = this.organizationLifecycleUpdates(
        input.action,
        now,
      );
      const subscriptionUpdates = this.subscriptionLifecycleUpdates(
        input.action,
        now,
        graceUntil,
      );
      await tx
        .update(organizations)
        .set({ ...organizationUpdates, updatedAt: now })
        .where(eq(organizations.id, organizationId));
      await tx
        .update(subscriptions)
        .set({ ...subscriptionUpdates, updatedAt: now })
        .where(eq(subscriptions.id, subscription.id));

      await this.writeAudit(tx, actor, {
        organizationId,
        action: `manual_subscription.${input.action}`,
        entity: "subscription",
        entityId: subscription.id,
        details: {
          reason: input.reason.trim(),
          previousBillingStatus: organization.billingStatus,
          nextBillingStatus: organizationUpdates.billingStatus,
          graceUntil: graceUntil?.toISOString() ?? null,
        },
      });
      return {
        organization: await this.getOrganizationOrThrow(tx, organizationId),
      };
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

  private ensureManualBillingControlsEnabled() {
    if (!this.featureFlags.manualBillingControlsEnabled()) {
      throw new ServiceUnavailableException({
        code: "MANUAL_BILLING_DISABLED",
        message: "Manual billing controls are disabled.",
      });
    }
  }

  private ensureSubscriptionRequestPermission(
    actor: ActivePlatformAdmin,
    organization: {
      currentPlan: string | null;
      billingStatus: string | null;
    },
    input: { planType: Exclude<PlanType, "free"> },
  ) {
    const isExistingManualSubscription = [
      "active_manual",
      "past_due_manual",
      "cancelled_manual",
      "suspended",
    ].includes(organization.billingStatus ?? "");
    if (!isExistingManualSubscription) {
      this.ensurePermission(actor, "SUBSCRIPTION_CREATE");
      return;
    }
    this.ensurePermission(
      actor,
      organization.currentPlan === input.planType
        ? "SUBSCRIPTION_RENEW"
        : "SUBSCRIPTION_CHANGE_PLAN",
    );
  }

  private async fulfillManualSubscription(
    tx: BillingTx,
    actor: ActivePlatformAdmin,
    input: {
      request: typeof manualBillingRequests.$inferSelect;
      item: typeof manualBillingRequestItems.$inferSelect;
      payment: typeof manualPayments.$inferSelect;
    },
  ) {
    const snapshotPlanType = input.item.planType as PlanType | null;
    const billingInterval = input.item.billingInterval;
    const coverageStartsAt = input.item.coverageStartsAt;
    const coverageEndsAt = input.item.coverageEndsAt;
    if (
      !isPaidManualPlan(snapshotPlanType) ||
      billingInterval !== "monthly" ||
      !(coverageStartsAt instanceof Date) ||
      !(coverageEndsAt instanceof Date)
    ) {
      throw new ConflictException({
        code: "INVALID_SUBSCRIPTION_SNAPSHOT",
      });
    }
    const planType = snapshotPlanType;

    const latestSubscription = await this.getLatestSubscription(
      tx,
      input.request.organizationId,
    );
    if (latestSubscription?.provider === "lemonsqueezy") {
      throw new ConflictException({
        code: "PROVIDER_MANAGED_SUBSCRIPTION",
        message: "Use provider-managed billing controls for this subscription.",
      });
    }

    const [latestManualSubscription] = await tx
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.organizationId, input.request.organizationId),
          eq(subscriptions.provider, "manual"),
        ),
      )
      .orderBy(desc(subscriptions.currentPeriodEnd))
      .limit(1);
    const subscriptionValues = {
      organizationId: input.request.organizationId,
      planType,
      status: "active" as const,
      provider: "manual" as const,
      billingInterval,
      cancelled: "false",
      currentPeriodStart: coverageStartsAt,
      currentPeriodEnd: coverageEndsAt,
      renewsAt: coverageEndsAt,
      endsAt: null,
      graceUntil: null,
      planPricePhp: input.item.unitPricePhp,
      updatedAt: new Date(),
    };
    let subscriptionId: string;
    if (latestManualSubscription?.id) {
      await tx
        .update(subscriptions)
        .set(subscriptionValues)
        .where(eq(subscriptions.id, latestManualSubscription.id));
      subscriptionId = latestManualSubscription.id;
    } else {
      const [createdSubscription] = await tx
        .insert(subscriptions)
        .values(subscriptionValues)
        .returning();
      subscriptionId = createdSubscription.id;
    }

    await tx
      .update(organizations)
      .set({
        currentPlan: planType,
        billingStatus: "active_manual",
        lastBillingAt: new Date(),
        nextBillingDueAt: coverageEndsAt,
        accessEndsAt: coverageEndsAt,
        billingPausedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, input.request.organizationId));

    await this.reconcileManualIncludedBookingCredits(tx, {
      organizationId: input.request.organizationId,
      planType,
      coverageStartsAt,
      paymentId: input.payment.id,
    });
    await this.writeAudit(tx, actor, {
      organizationId: input.request.organizationId,
      action: "manual_subscription.activated",
      entity: "subscription",
      entityId: subscriptionId,
      details: {
        billingRequestId: input.request.id,
        manualPaymentId: input.payment.id,
        planType,
        billingInterval,
        coverageStartsAt: coverageStartsAt.toISOString(),
        coverageEndsAt: coverageEndsAt.toISOString(),
        amountPhp: input.payment.amountPhp,
      },
    });
  }

  private async reconcileManualIncludedBookingCredits(
    tx: BillingTx,
    input: {
      organizationId: string;
      planType: Exclude<PlanType, "free">;
      coverageStartsAt: Date;
      paymentId: string;
    },
  ) {
    const month = this.currentMonthKey(input.coverageStartsAt);
    const nextIncluded = getPlanCatalogEntry(input.planType).limits
      .verifiedOnlineBookingsPerMonth;
    const [existing] = await tx
      .select()
      .from(verifiedOnlineBookingCredits)
      .where(
        and(
          eq(
            verifiedOnlineBookingCredits.organizationId,
            input.organizationId,
          ),
          eq(verifiedOnlineBookingCredits.month, month),
        ),
      )
      .limit(1);
    if (!existing) {
      await tx.insert(verifiedOnlineBookingCredits).values({
        organizationId: input.organizationId,
        month,
        includedGranted: nextIncluded,
        addonGranted: 0,
        used: 0,
        sourcePlan: input.planType,
        lastReconciledAt: new Date(),
      }).returning();
      return;
    }

    const includedGranted = Math.max(existing.includedGranted, nextIncluded);
    if (
      includedGranted === existing.includedGranted &&
      existing.sourcePlan === input.planType
    ) {
      return;
    }
    await tx
      .update(verifiedOnlineBookingCredits)
      .set({
        includedGranted,
        used: existing.used,
        sourcePlan: input.planType,
        lastReconciledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(
            verifiedOnlineBookingCredits.organizationId,
            input.organizationId,
          ),
          eq(verifiedOnlineBookingCredits.month, month),
        ),
      );
    await tx.insert(creditReconciliationEvents).values({
      organizationId: input.organizationId,
      creditType: "verified_online_booking",
      month,
      eventType: "subscription_upgrade",
      previousPlan: existing.sourcePlan,
      nextPlan: input.planType,
      includedBefore: existing.includedGranted,
      includedAfter: includedGranted,
      addonBefore: existing.addonGranted,
      addonAfter: existing.addonGranted,
      usedBefore: existing.used,
      usedAfter: existing.used,
      providerEventId: input.paymentId,
    });
  }

  private async getLatestSubscription(tx: BillingTx, organizationId: string) {
    const [subscription] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .orderBy(desc(subscriptions.currentPeriodEnd))
      .limit(1);
    return subscription ?? null;
  }

  private permissionForAction(
    action: ManualSubscriptionAction,
  ): PlatformAdminPermission {
    const permissions: Record<
      ManualSubscriptionAction,
      PlatformAdminPermission
    > = {
      mark_past_due: "SUBSCRIPTION_MARK_PAST_DUE",
      set_grace_until: "SUBSCRIPTION_SET_GRACE",
      suspend: "SUBSCRIPTION_SUSPEND",
      reactivate: "SUBSCRIPTION_REACTIVATE",
      cancel: "SUBSCRIPTION_CANCEL",
    };
    return permissions[action];
  }

  private organizationLifecycleUpdates(
    action: ManualSubscriptionAction,
    now: Date,
  ) {
    switch (action) {
      case "mark_past_due":
      case "set_grace_until":
        return { billingStatus: "past_due_manual" as const };
      case "suspend":
        return {
          billingStatus: "suspended" as const,
          billingPausedAt: now,
        };
      case "reactivate":
        return {
          billingStatus: "active_manual" as const,
          billingPausedAt: null,
        };
      case "cancel":
        return {
          billingStatus: "cancelled_manual" as const,
          billingPausedAt: now,
        };
    }
  }

  private subscriptionLifecycleUpdates(
    action: ManualSubscriptionAction,
    now: Date,
    graceUntil: Date | null,
  ) {
    switch (action) {
      case "mark_past_due":
        return { status: "past_due" as const, graceUntil: null };
      case "set_grace_until":
        return { status: "past_due" as const, graceUntil };
      case "suspend":
        return { status: "paused" as const, graceUntil: null };
      case "reactivate":
        return {
          status: "active" as const,
          cancelled: "false",
          endsAt: null,
          graceUntil: null,
        };
      case "cancel":
        return {
          status: "cancelled" as const,
          cancelled: "true",
          endsAt: now,
          renewsAt: null,
          graceUntil: null,
        };
    }
  }

  private parseRequiredDate(
    value: string | null | undefined,
    message: string,
  ) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) {
      throw new BadRequestException(message);
    }
    return date;
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
    const emailDeliveries = await tx
      .select()
      .from(manualBillingEmailDeliveries)
      .where(eq(manualBillingEmailDeliveries.billingRequestId, request.id))
      .orderBy(desc(manualBillingEmailDeliveries.attemptedAt))
      .limit(100);
    const serializedEmailDeliveries = emailDeliveries.map((delivery) => ({
      ...delivery,
      attemptedAt:
        delivery.attemptedAt?.toISOString?.() ?? delivery.attemptedAt,
      sentAt: delivery.sentAt?.toISOString?.() ?? delivery.sentAt ?? null,
    }));

    return {
      id: request.id,
      referenceNumber: request.referenceNumber,
      organizationId: request.organizationId,
      organizationName: organization.name,
      manualBillingControlsEnabled:
        this.featureFlags.manualBillingControlsEnabled(),
      status: request.status,
      totalAmountPhp: request.totalAmountPhp,
      dueAt: request.dueAt?.toISOString?.() ?? request.dueAt ?? null,
      createdAt: request.createdAt?.toISOString?.() ?? request.createdAt,
      notes: request.notes ?? null,
      items,
      payments,
      fulfillments: fulfillments.filter(Boolean),
      auditLogs,
      emailDeliveries: serializedEmailDeliveries,
      latestPaymentRequestEmailDelivery:
        serializedEmailDeliveries.find(
          (delivery) => delivery.kind === "payment_request",
        ) ?? null,
      latestPaymentAcknowledgmentEmailDelivery:
        serializedEmailDeliveries.find(
          (delivery) => delivery.kind === "payment_acknowledgment",
        ) ?? null,
      paymentInstructions: this.buildPaymentInstructions({
        businessName: organization.name,
        sku: items[0]?.sku ?? "Manual top-up",
        purchaseKind: items[0]?.purchaseKind ?? "sms_segment_topup",
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
    purchaseKind: string;
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
      input.purchaseKind === "subscription"
        ? "Your Tyvera subscription payment request is ready."
        : "Your Tyvera top-up request is ready.",
      input.purchaseKind === "subscription"
        ? `Plan: ${input.sku}`
        : `Package: ${input.sku}`,
      `Amount: ${this.formatPhp(input.amountPhp)}`,
      `Reference: ${input.referenceNumber}`,
      "Payment method:",
      paymentMethodLines.join("\n") || "Use the payment account shared by Tyvera support.",
      input.purchaseKind === "subscription"
        ? "After payment, please send your transaction reference number so we can verify the payment and activate your Tyvera subscription."
        : "After payment, please send your transaction reference number so we can apply your credits.",
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

  private async sendAutomaticPaymentRequestEmail(
    actor: ActivePlatformAdmin,
    billingRequestId: string,
  ) {
    try {
      return await this.billingEmails.sendPaymentRequestEmail({
        billingRequestId,
        attemptedByPlatformAdminId: actor.id,
        mode: "automatic",
      });
    } catch {
      return this.unavailableEmailDelivery(
        billingRequestId,
        "payment_request",
      );
    }
  }

  private async sendAutomaticPaymentAcknowledgmentEmail(
    actor: ActivePlatformAdmin,
    billingRequestId: string,
    manualPaymentId: string,
  ) {
    try {
      return await this.billingEmails.sendPaymentAcknowledgmentEmail({
        billingRequestId,
        manualPaymentId,
        attemptedByPlatformAdminId: actor.id,
        mode: "automatic",
      });
    } catch {
      return this.unavailableEmailDelivery(
        billingRequestId,
        "payment_acknowledgment",
        manualPaymentId,
      );
    }
  }

  private unavailableEmailDelivery(
    billingRequestId: string,
    kind: "payment_request" | "payment_acknowledgment",
    manualPaymentId: string | null = null,
  ) {
    return {
      id: `unpersisted:${randomUUID()}`,
      billingRequestId,
      manualPaymentId,
      kind,
      recipientEmail: null,
      status: "failed" as const,
      providerMessageId: null,
      failureReason: "unexpected_provider_error",
      attemptedAt: new Date().toISOString(),
      sentAt: null,
    };
  }

  private withLatestDelivery<
    T extends {
      emailDeliveries?: Array<Record<string, unknown>>;
      latestPaymentRequestEmailDelivery?: Record<string, unknown> | null;
      latestPaymentAcknowledgmentEmailDelivery?: Record<string, unknown> | null;
    },
  >(detail: T, delivery: Record<string, unknown>) {
    const kind = delivery.kind;
    return {
      ...detail,
      emailDeliveries: [delivery, ...(detail.emailDeliveries ?? [])],
      ...(kind === "payment_request"
        ? { latestPaymentRequestEmailDelivery: delivery }
        : { latestPaymentAcknowledgmentEmailDelivery: delivery }),
    };
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
