import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { getDb } from "@suki/database";
import {
  aiUsageEvents,
  creditReconciliationEvents,
  emailCredits,
  organizations,
  processedWebhookEvents,
  smsAddons,
  smsCredits,
  subscriptions,
  verifiedOnlineBookingAddons,
  verifiedOnlineBookingCredits,
} from "@suki/database";
import { and, desc, eq, gt, inArray, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { createHash } from "crypto";
import type { BillingAddonSku, BillingInterval, PlanType } from "@suki/types";
import {
  LemonsqueezyService,
  type LemonSubscriptionResponse,
} from "./lemonsqueezy.service";
import {
  applyMonthlyIncludedUpgrade,
  computeCreditLedgerRemaining,
} from "./credit-reconciliation";
import {
  getPlanCatalogEntry,
  resolveAddonSku,
  resolveSubscriptionVariantEnvKey,
  SMS_INCLUDED_BY_PLAN,
} from "./plan-catalog";
import { FeatureFlagsService } from "../common/feature-flags.service";
import { isLemonGraceExpired, LEMON_PAYMENT_GRACE_MS } from "../common/org-billing-state.service";
import { SmsAddonGrantService } from "./sms-addon-grant.service";
import { VerifiedBookingAddonGrantService } from "./verified-booking-addon-grant.service";

type SubscriptionStatus =
  | "active"
  | "cancelled"
  | "past_due"
  | "trialing"
  | "paused"
  | "expired"
  | "unpaid";

type LemonWebhookPayload = {
  meta?: {
    event_name?: string;
    custom_data?: Record<string, unknown>;
  };
  data?: {
    id?: string;
    attributes?: Record<string, unknown>;
  };
};

// unpaid stays live: LS can still recover it, so a new checkout would double-bill (D2).
const LIVE_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due", "unpaid", "paused"] as const;
const PLAN_TIER_RANK: Record<PlanType, number> = { free: 0, starter: 1, growth: 2, pro: 3 };
const WEBHOOK_PROCESSING_STALE_MS = 10 * 60 * 1000;

type ReconcileOutcome = {
  status: "processed" | "ignored";
  reason?: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly lemonsqueezy: LemonsqueezyService,
    private readonly smsAddonGrant: SmsAddonGrantService = new SmsAddonGrantService(),
    private readonly verifiedBookingAddonGrant: VerifiedBookingAddonGrantService = new VerifiedBookingAddonGrantService(),
  ) {}

  private isSelfServeBillingEnabled(): boolean {
    return new FeatureFlagsService().selfServeBillingEnabled();
  }

  private throwBillingDisabled(): never {
    throw new ServiceUnavailableException({
      code: "BILLING_DISABLED",
      message: "Self-serve billing is disabled.",
    });
  }

  async getSubscription(organizationId: string) {
    const db = getDb();
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .orderBy(desc(subscriptions.currentPeriodEnd))
      .limit(1);
    return sub ?? null;
  }

  getPlansResponse(input: {
    checkoutEnabled: boolean;
    manualRequestEnabled?: boolean;
    annualCheckoutEnabled?: boolean;
  }) {
    return {
      checkoutEnabled: input.checkoutEnabled,
      manualRequestEnabled: input.manualRequestEnabled ?? false,
      annualCheckoutEnabled: input.annualCheckoutEnabled ?? false,
      plans: ["free", "starter", "growth", "pro"].map((planType) => {
        const entry = getPlanCatalogEntry(planType as PlanType);
        return entry;
      }),
    };
  }

  async getBillingStatus(organizationId: string) {
    const subscription = await this.getSubscription(organizationId);
    const graceExpired =
      subscription?.provider === "lemonsqueezy" &&
      isLemonGraceExpired(subscription.status, subscription.graceUntil ?? null, new Date());
    const fallbackPlanType = graceExpired ? "free" : subscription?.planType ?? "free";
    const plan = getPlanCatalogEntry(fallbackPlanType);
    const ledger = await this.getVerifiedBookingLedger(organizationId);
    const smsLedger = await this.getSmsLedger(organizationId);
    const emailLedger = await this.getEmailLedger(organizationId);
    const aiRequestsUsed = await this.getAiRequestsUsed(organizationId);
    const ownerWarnings = await this.buildOwnerWarnings(organizationId, subscription);
    const verifiedOnlineBookingCredits = ledger
      ? {
          included: ledger.includedGranted,
          addon: ledger.addonGranted,
          used: ledger.used,
          total: ledger.includedGranted + ledger.addonGranted,
          remaining: computeCreditLedgerRemaining(ledger),
        }
      : {
          included: plan.limits.verifiedOnlineBookingsPerMonth,
          addon: 0,
          used: 0,
          total: plan.limits.verifiedOnlineBookingsPerMonth,
          remaining: plan.limits.verifiedOnlineBookingsPerMonth,
        };
    const smsSegmentCredits = smsLedger
      ? {
          included: smsLedger.included,
          addon: smsLedger.addon,
          used: smsLedger.used,
          total: smsLedger.included + smsLedger.addon,
          remaining: Math.max(0, smsLedger.included + smsLedger.addon - smsLedger.used),
        }
      : {
          included: 0,
          addon: 0,
          used: 0,
          total: 0,
          remaining: 0,
        };
    const emailCreditsStatus = emailLedger
      ? {
          included: emailLedger.included,
          used: emailLedger.used,
          total: emailLedger.included,
          remaining: Math.max(0, emailLedger.included - emailLedger.used),
        }
      : {
          included: plan.limits.emailMessagesPerMonth,
          used: 0,
          total: plan.limits.emailMessagesPerMonth,
          remaining: plan.limits.emailMessagesPerMonth,
        };
    const aiIncluded = plan.limits.aiRequestsPerMonth;
    const aiRequests = {
      included: aiIncluded,
      used: aiRequestsUsed,
      total: aiIncluded,
      remaining: Math.max(0, aiIncluded - aiRequestsUsed),
    };

    if (!subscription) {
      return {
        planType: "free" as const,
        billingInterval: null,
        billingStatus: "free_active" as const,
        cancellationPending: false,
        scheduledPlanType: null,
        scheduledBillingInterval: null,
        scheduledChangeEffectiveAt: null,
        renewsAt: null,
        endsAt: null,
        verifiedOnlineBookingCredits,
        smsSegmentCredits,
        emailCredits: emailCreditsStatus,
        aiRequests,
        ownerWarnings,
        subscription: null,
      };
    }

    return {
      planType: fallbackPlanType,
      billingInterval: subscription.billingInterval,
      billingStatus: this.mapOrgBillingStatus(subscription.status, subscription.endsAt ?? null),
      cancellationPending: subscription.cancelled === "true",
      scheduledPlanType: subscription.scheduledPlanType ?? null,
      scheduledBillingInterval: subscription.scheduledBillingInterval ?? null,
      scheduledChangeEffectiveAt:
        subscription.scheduledChangeEffectiveAt?.toISOString() ?? null,
      renewsAt: subscription.renewsAt?.toISOString() ?? null,
      endsAt: subscription.endsAt?.toISOString() ?? null,
      verifiedOnlineBookingCredits,
      smsSegmentCredits,
      emailCredits: emailCreditsStatus,
      aiRequests,
      ownerWarnings,
      subscription,
    };
  }

  async createSubscriptionCheckout(input: {
    organizationId: string;
    userId: string;
    planType: Exclude<PlanType, "free">;
    billingInterval: BillingInterval;
  }) {
    if (!this.isSelfServeBillingEnabled()) {
      this.throwBillingDisabled();
    }

    if (await this.findLiveLemonSubscriptionId(getDb(), input.organizationId)) {
      throw new ConflictException({
        code: "SUBSCRIPTION_EXISTS",
        message: "This account already has a subscription. Change plan instead of starting a new checkout.",
      });
    }

    const plan = getPlanCatalogEntry(input.planType);
    const variantEnvKey = resolveSubscriptionVariantEnvKey(
      input.planType,
      input.billingInterval,
    );
    const variantId = this.getRequiredEnv(variantEnvKey);
    const appUrl = this.getAppUrl();

    return this.lemonsqueezy.createCheckout({
      variantId,
      organizationId: input.organizationId,
      userId: input.userId,
      purchaseKind: "subscription",
      planType: input.planType,
      billingInterval: input.billingInterval,
      productLabel: `${plan.displayName} ${input.billingInterval}`,
      successUrl: `${appUrl}/settings/billing?checkout=success`,
      cancelUrl: `${appUrl}/settings/billing?checkout=cancelled`,
    });
  }

  async createAddonCheckout(input: {
    organizationId: string;
    userId: string;
    sku: BillingAddonSku;
  }) {
    if (!this.isSelfServeBillingEnabled()) {
      this.throwBillingDisabled();
    }

    const addon = resolveAddonSku(input.sku);
    const variantId = this.getRequiredEnv(addon.variantEnvKey);
    const appUrl = this.getAppUrl();

    return this.lemonsqueezy.createCheckout({
      variantId,
      organizationId: input.organizationId,
      userId: input.userId,
      purchaseKind: addon.purchaseKind,
      sku: addon.sku,
      productLabel: addon.sku,
      successUrl: `${appUrl}/settings/billing?checkout=success`,
      cancelUrl: `${appUrl}/settings/billing?checkout=cancelled`,
    });
  }

  async createCustomerPortal(organizationId: string) {
    if (!this.isSelfServeBillingEnabled()) {
      this.throwBillingDisabled();
    }

    const subscription = await this.getSubscription(organizationId);
    if (!subscription?.providerSubscriptionId) {
      throw new NotFoundException("Billing portal is not available for this account.");
    }

    const providerSubscription = await this.lemonsqueezy.getSubscription(
      subscription.providerSubscriptionId,
    );
    const providerUrls = providerSubscription.data?.attributes?.urls;
    const url =
      this.readString(providerUrls?.customer_portal) ??
      this.readString(providerUrls?.update_payment_method) ??
      subscription.customerPortalUrl ??
      subscription.updatePaymentMethodUrl;

    if (!url) {
      throw new NotFoundException("Billing portal is not available for this account.");
    }

    const db = getDb();
    await db
      .update(subscriptions)
      .set({
        customerPortalUrl: this.readString(providerUrls?.customer_portal) ?? subscription.customerPortalUrl ?? null,
        updatePaymentMethodUrl:
          this.readString(providerUrls?.update_payment_method) ??
          subscription.updatePaymentMethodUrl ??
          null,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id));

    return { url };
  }

  async changePlan(
    organizationId: string,
    input: { planType: PlanType; billingInterval?: BillingInterval },
  ) {
    if (!this.isSelfServeBillingEnabled()) {
      this.throwBillingDisabled();
    }

    const subscription = await this.getSubscription(organizationId);
    if (!subscription?.providerSubscriptionId) {
      throw new NotFoundException("Subscription not found.");
    }

    if (!this.isLiveLemonSubscription(subscription)) {
      throw new ConflictException({
        code: "SUBSCRIPTION_NOT_ACTIVE",
        message: "This subscription has ended. Start a new checkout to subscribe again.",
      });
    }

    if (input.planType === "free") {
      throw new BadRequestException("Use cancellation to return to the free plan.");
    }

    const targetInterval = input.billingInterval ?? this.resolveSubscriptionInterval(subscription);
    if (!targetInterval) {
      throw new BadRequestException("Billing interval required.");
    }

    const variantId = this.getRequiredEnv(
      resolveSubscriptionVariantEnvKey(input.planType, targetInterval),
    );
    const scheduled = this.isScheduledDowngrade(
      subscription.planType,
      this.resolveSubscriptionInterval(subscription) ?? targetInterval,
      input.planType,
      targetInterval,
    );

    await this.lemonsqueezy.updateSubscription(subscription.providerSubscriptionId, {
      variantId,
      ...(scheduled
        ? { disableProrations: true }
        : { invoiceImmediately: true }),
    });

    const db = getDb();
    if (scheduled) {
      await db
        .update(subscriptions)
        .set({
          scheduledPlanType: input.planType,
          scheduledBillingInterval: targetInterval,
          scheduledChangeEffectiveAt: subscription.renewsAt ?? subscription.currentPeriodEnd ?? null,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, subscription.id));
    } else {
      await db
        .update(subscriptions)
        .set({
          scheduledPlanType: null,
          scheduledBillingInterval: null,
          scheduledChangeEffectiveAt: null,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, subscription.id));
    }

    await this.markPendingSync(subscription.id, {
      action: scheduled ? "schedule_downgrade" : "change_plan",
      targetPlanType: input.planType,
      targetBillingInterval: targetInterval,
    });

    return {
      organizationId,
      subscriptionId: subscription.id ?? null,
      scheduled,
      pendingWebhookSync: true,
      planType: input.planType,
      billingInterval: targetInterval,
    };
  }

  async cancel(organizationId: string) {
    if (!this.isSelfServeBillingEnabled()) {
      this.throwBillingDisabled();
    }

    const subscription = await this.getSubscription(organizationId);
    if (!subscription?.providerSubscriptionId) {
      throw new NotFoundException("Subscription not found.");
    }

    const providerResponse = await this.lemonsqueezy.cancelSubscription(
      subscription.providerSubscriptionId,
    );
    const endsAt = this.parseDate(providerResponse.data?.attributes?.ends_at);

    await this.markPendingSync(subscription.id, {
      action: "cancel",
      targetPlanType: "free",
      targetBillingInterval: this.resolveSubscriptionInterval(subscription),
    });

    return {
      organizationId,
      subscriptionId: subscription.id ?? null,
      cancellationScheduled: true,
      pendingWebhookSync: true,
      endsAt: endsAt?.toISOString() ?? null,
    };
  }

  async resume(organizationId: string) {
    if (!this.isSelfServeBillingEnabled()) {
      this.throwBillingDisabled();
    }

    const subscription = await this.getSubscription(organizationId);
    if (!subscription?.providerSubscriptionId) {
      throw new NotFoundException("Subscription not found.");
    }

    await this.lemonsqueezy.updateSubscription(
      subscription.providerSubscriptionId,
      {
        cancelled: false,
      },
    );

    await this.markPendingSync(subscription.id, {
      action: "resume",
      targetPlanType: subscription.planType,
      targetBillingInterval: this.resolveSubscriptionInterval(subscription),
    });

    return {
      organizationId,
      subscriptionId: subscription.id ?? null,
      resumed: true,
      pendingWebhookSync: true,
    };
  }

  async isWebhookEventProcessed(eventId: string): Promise<boolean> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(processedWebhookEvents)
      .where(
        and(
          eq(processedWebhookEvents.provider, "lemonsqueezy"),
          eq(processedWebhookEvents.eventId, eventId),
        ),
      )
      .limit(1);
    return !!row;
  }

  async recordWebhookEventId(eventId: string, eventName?: string): Promise<void> {
    const db = getDb();
    try {
      await db.insert(processedWebhookEvents).values({
        provider: "lemonsqueezy",
        eventId,
        eventName: eventName ?? null,
        status: "processed",
      });
    } catch {
      // Ignore duplicate event id
    }
  }

  async reconcileWebhookEvent(
    payload: LemonWebhookPayload,
    providedDeliveryKey?: string,
  ): Promise<"processed" | "ignored" | "duplicate"> {
    if (!this.isSelfServeBillingEnabled()) {
      // non-2xx so Lemon Squeezy retries once billing is back on
      this.throwBillingDisabled();
    }

    const eventName = payload.meta?.event_name ?? "unknown";
    const resourceId = payload.data?.id ?? null;
    const isSubscriptionEvent =
      eventName.startsWith("subscription_") && !eventName.startsWith("subscription_payment_");
    const claimMetadata = {
      resourceId,
      ...(isSubscriptionEvent
        ? {
            subscriptionId: resourceId,
            providerUpdatedAt: this.readString(payload.data?.attributes?.updated_at),
          }
        : {}),
    };

    const payloadHash = createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex");

    const deliveryKey =
      providedDeliveryKey ?? `lemonsqueezy:${payloadHash}`;

    const db = getDb();

    const claimedRows = await db
      .insert(processedWebhookEvents)
      .values({
        provider: "lemonsqueezy",
        eventId: deliveryKey,
        eventName,
        payloadHash,
        status: "processing",
        metadata: claimMetadata,
      })
      // Failed deliveries, and claims abandoned mid-processing (crash/timeout), are re-claimable so the
      // provider's retry reprocesses them; a fresh "processing" or completed row stays a duplicate.
      .onConflictDoUpdate({
        target: processedWebhookEvents.eventId,
        set: {
          status: "processing",
          failureReason: null,
          metadata: claimMetadata,
          processedAt: new Date(),
          retryCount: sql`${processedWebhookEvents.retryCount} + 1`,
        },
        setWhere: or(
          eq(processedWebhookEvents.status, "failed"),
          and(
            eq(processedWebhookEvents.status, "processing"),
            lt(processedWebhookEvents.processedAt, new Date(Date.now() - WEBHOOK_PROCESSING_STALE_MS)),
          ),
        ),
      })
      .returning({
        id: processedWebhookEvents.id,
      });

    if (claimedRows.length === 0) {
      return "duplicate";
    }

    let outcome: ReconcileOutcome = { status: "processed" };

    try {
      await db.transaction(async (tx) => {
        // subscription_payment_* carry an invoice, not a subscription; LS sends subscription_updated with each.
        if (isSubscriptionEvent) {
          outcome = await this.reconcileSubscriptionEvent(tx, payload);
        } else if (eventName === "order_created") {
          await this.reconcileOrderCreatedEvent(tx, payload);
        } else if (eventName === "order_refunded") {
          outcome = await this.reconcileOrderRefundedEvent(tx, payload);
        } else if (eventName === "subscription_payment_refunded") {
          outcome = await this.reconcileSubscriptionPaymentRefundedEvent(tx, payload);
        } else {
          outcome = { status: "ignored", reason: "unhandled_event" };
        }
      });

      await db
        .update(processedWebhookEvents)
        .set({
          status: outcome.status,
          metadata: {
            ...claimMetadata,
            ...(outcome.reason ? { reason: outcome.reason } : {}),
            ...outcome.metadata,
          },
          processedAt: new Date(),
        })
        .where(eq(processedWebhookEvents.eventId, deliveryKey));

      return outcome.status;
    } catch (err) {
      await db
        .update(processedWebhookEvents)
        .set({
          status: "failed",
          failureReason:
            err instanceof Error ? err.message : "Webhook reconciliation failed",
          metadata: { ...claimMetadata, eventName },
          processedAt: new Date(),
        })
        .where(eq(processedWebhookEvents.eventId, deliveryKey));
      throw err;
    }
  }

  private getRequiredEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value || value.toLowerCase().includes("placeholder")) {
      this.logger.error(`Billing configuration missing required value: ${name}`);
      throw new ServiceUnavailableException({
        code: "BILLING_MISCONFIGURED",
        message: "Billing is temporarily unavailable.",
      });
    }
    return value;
  }

  private getAppUrl(): string {
    return process.env.FRONTEND_URL?.trim() || "http://localhost:3000";
  }

  private async reconcileSubscriptionEvent(
    tx: {
      select: ReturnType<typeof getDb>["select"];
      insert: ReturnType<typeof getDb>["insert"];
      update: ReturnType<typeof getDb>["update"];
    },
    payload: LemonWebhookPayload,
  ): Promise<ReconcileOutcome> {
    const eventName = payload.meta?.event_name ?? "subscription_updated";
    const eventId = payload.data?.id ?? null;
    const providerSubscriptionId = this.readString(payload.data?.id);
    const attributes = payload.data?.attributes ?? {};
    const customData = payload.meta?.custom_data ?? {};
    const organizationId = this.readString(customData.organization_id);
    if (!organizationId) {
      return { status: "ignored", reason: "missing_organization_id" };
    }

    // LS does not guarantee delivery order; an event older than the last one applied would roll state back.
    const providerUpdatedAt = this.parseDate(attributes.updated_at);
    if (providerSubscriptionId && providerUpdatedAt) {
      const [lastApplied] = await tx
        .select({ metadata: processedWebhookEvents.metadata })
        .from(processedWebhookEvents)
        .where(
          and(
            eq(processedWebhookEvents.provider, "lemonsqueezy"),
            sql`${processedWebhookEvents.metadata}->>'subscriptionId' = ${providerSubscriptionId}`,
            eq(processedWebhookEvents.status, "processed"),
          ),
        )
        .orderBy(desc(processedWebhookEvents.processedAt))
        .limit(1);
      const lastAppliedMetadata = (lastApplied?.metadata ?? {}) as Record<string, unknown>;
      const lastUpdatedAt = this.parseDate(lastAppliedMetadata.providerUpdatedAt);
      if (lastUpdatedAt && providerUpdatedAt.getTime() < lastUpdatedAt.getTime()) {
        return { status: "ignored", reason: "stale_provider_event" };
      }
    }

    // Match the provider subscription first so an event for subscription A never rewrites the row tracking B.
    const [rowForSubscription] = providerSubscriptionId
      ? await tx
          .select()
          .from(subscriptions)
          .where(
            and(
              eq(subscriptions.organizationId, organizationId),
              eq(subscriptions.providerSubscriptionId, providerSubscriptionId),
            ),
          )
          .limit(1)
      : [];
    let existingSubscription = rowForSubscription;
    if (!existingSubscription) {
      // First event: adopt the org's provider-less row (sign-up trial / manual era) instead of duplicating it.
      const [unclaimed] = await tx
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.organizationId, organizationId),
            isNull(subscriptions.providerSubscriptionId),
          ),
        )
        .orderBy(desc(subscriptions.currentPeriodEnd))
        .limit(1);
      existingSubscription = unclaimed;
    }

    // variant_id is the live LS plan; custom_data is frozen at checkout and only a fallback.
    const variantPlan = this.resolvePlanFromVariantId(
      this.readString(attributes.variant_id),
    );
    const planType = this.resolvePlanType(
      variantPlan?.planType ?? this.readString(customData.plan_type),
      existingSubscription?.planType ?? "free",
    );
    const billingInterval = this.resolveBillingInterval(
      variantPlan?.billingInterval ?? this.readString(customData.billing_interval),
      (existingSubscription?.billingInterval as BillingInterval | null) ?? null,
    );
    const status = this.resolveSubscriptionStatus(
      eventName,
      this.readString(attributes.status),
    );
    const now = new Date();
    const renewsAt = this.parseDate(attributes.renews_at);
    const endsAt = this.parseDate(attributes.ends_at);
    // LS subscription objects carry no current_period_*; renews_at (or ends_at once cancelled) closes the paid cycle.
    const providerPeriodEnd = renewsAt ?? endsAt;
    const currentPeriodStart =
      this.parseDate(attributes.current_period_start) ??
      (providerPeriodEnd
        ? this.subtractBillingInterval(providerPeriodEnd, billingInterval ?? "monthly")
        : null) ??
      existingSubscription?.currentPeriodStart ??
      now;
    const currentPeriodEnd =
      this.parseDate(attributes.current_period_end) ??
      providerPeriodEnd ??
      existingSubscription?.currentPeriodEnd ??
      currentPeriodStart;
    const trialEndsAt = this.parseDate(attributes.trial_ends_at);
    const cancelled = this.readBoolean(attributes.cancelled)
      ? "true"
      : status === "cancelled" || status === "expired"
        ? "true"
        : "false";
    const urls = (attributes.urls ?? {}) as Record<string, unknown>;
    const scheduledChangeDue =
      existingSubscription?.scheduledChangeEffectiveAt instanceof Date &&
      existingSubscription.scheduledChangeEffectiveAt.getTime() <= now.getTime();
    const scheduledDowngrade =
      !!existingSubscription &&
      !scheduledChangeDue &&
      status === "active" &&
      existingSubscription.status === "active" &&
      planType !== "free" &&
      this.isScheduledDowngrade(
        existingSubscription.planType,
        (existingSubscription.billingInterval as BillingInterval | null) ?? "monthly",
        planType,
        billingInterval ?? "monthly",
      );
    const appliedPlanType = scheduledDowngrade
      ? existingSubscription?.planType ?? planType
      : planType;
    const paymentFailing = status === "past_due" || status === "unpaid";
    const wasFailing =
      existingSubscription?.status === "past_due" || existingSubscription?.status === "unpaid";
    // Grace runs 7 days from the first failure we saw; later retries must not extend it.
    const graceUntil = paymentFailing
      ? (wasFailing ? existingSubscription?.graceUntil ?? null : null) ??
        new Date(now.getTime() + LEMON_PAYMENT_GRACE_MS)
      : null;
    const nextOrgPlan =
      status === "expired" || isLemonGraceExpired(status, graceUntil, now)
        ? "free"
        : appliedPlanType;

    const subscriptionValues = {
      organizationId,
      planType: appliedPlanType,
      status,
      provider: "lemonsqueezy" as const,
      providerSubscriptionId: providerSubscriptionId ?? existingSubscription?.providerSubscriptionId ?? null,
      providerCustomerId: this.readString(attributes.customer_id),
      providerOrderId: this.readString(attributes.order_id),
      providerProductId: this.readString(attributes.product_id),
      providerVariantId: this.readString(attributes.variant_id),
      providerSubscriptionItemId: this.readString(
        (attributes.first_subscription_item as Record<string, unknown> | undefined)?.id,
      ),
      billingInterval: billingInterval ?? existingSubscription?.billingInterval ?? null,
      cancelled,
      currentPeriodStart,
      currentPeriodEnd,
      renewsAt,
      endsAt,
      trialEndsAt,
      graceUntil,
      cardBrand: this.readString(attributes.card_brand),
      cardLastFour: this.readString(attributes.card_last_four),
      updatePaymentMethodUrl: this.readString(urls.update_payment_method),
      customerPortalUrl: this.readString(urls.customer_portal),
      lastProviderEventId: eventId,
      // plan_price_php is NOT NULL and PHP-denominated; Lemon Squeezy charges USD, so no PHP amount applies.
      planPricePhp: 0,
      scheduledPlanType: scheduledDowngrade ? planType : null,
      scheduledBillingInterval: scheduledDowngrade ? billingInterval : null,
      // keep the date changePlan set; re-deriving from renews_at would slide the due date forward every event
      scheduledChangeEffectiveAt: scheduledDowngrade
        ? existingSubscription?.scheduledChangeEffectiveAt ?? renewsAt ?? currentPeriodEnd
        : null,
      ...this.clearPendingSync(),
    };

    if (existingSubscription?.id) {
      await tx
        .update(subscriptions)
        .set(subscriptionValues)
        .where(eq(subscriptions.id, existingSubscription.id));
    } else {
      await tx.insert(subscriptions).values(subscriptionValues);
    }

    // A late event for an ended subscription must not downgrade an org that already runs a newer one.
    if (
      !this.isLiveLemonSubscription({ status, endsAt }, now) &&
      (await this.findLiveLemonSubscriptionId(tx, organizationId, providerSubscriptionId))
    ) {
      return { status: "processed", reason: "superseded_subscription" };
    }

    await tx
      .update(organizations)
      .set({
        currentPlan: nextOrgPlan,
        billingStatus: this.mapOrgBillingStatus(status, endsAt),
        nextBillingDueAt: renewsAt,
        // manual-era access dates would otherwise force "suspended" in OrgBillingStateService
        accessEndsAt: null,
        billingPausedAt: null,
        updatedAt: now,
      })
      .where(eq(organizations.id, organizationId));

    // No included-credit grants while a payment is failing.
    if (!scheduledDowngrade && !paymentFailing && nextOrgPlan !== "free" && status !== "expired") {
      await this.reconcileIncludedBookingCredits(tx, {
        organizationId,
        eventId,
        planType: nextOrgPlan,
        currentPeriodStart,
      });
      await this.syncIncludedMonthlyAllowances(tx, organizationId, nextOrgPlan);
    }

    return { status: "processed" };
  }

  private async reconcileOrderCreatedEvent(
    tx: {
      select: ReturnType<typeof getDb>["select"];
      insert: ReturnType<typeof getDb>["insert"];
      update: ReturnType<typeof getDb>["update"];
    },
    payload: LemonWebhookPayload,
  ): Promise<void> {
    const eventId = payload.data?.id ?? null;
    const customData = payload.meta?.custom_data ?? {};
    const organizationId = this.readString(customData.organization_id);
    const purchaseKind = this.readString(customData.purchase_kind);
    const sku = this.readString(customData.sku);
    const userId = this.readString(customData.user_id);
    if (!organizationId || !purchaseKind || !sku) {
      return;
    }

    const addon = resolveAddonSku(sku as BillingAddonSku);
    if (purchaseKind === "online_booking_topup") {
      await this.verifiedBookingAddonGrant.grant({
        organizationId,
        units: addon.units,
        // price_php is NOT NULL and PHP-denominated; the USD charge is kept in reconciliation metadata.
        pricePhp: 0,
        sku: addon.sku,
        source: "lemonsqueezy",
        sourceReference: eventId ?? `order_created:${organizationId}:${sku}`,
        purchasedByUserId: userId,
        metadata: { priceUsd: addon.priceUsd },
      }, tx);
      return;
    }

    if (purchaseKind === "sms_segment_topup") {
      await this.smsAddonGrant.grant({
        organizationId,
        units: addon.units,
        // pack_price_php is NOT NULL and PHP-denominated; the USD charge is kept in reconciliation metadata.
        pricePhp: 0,
        source: "lemonsqueezy",
        sourceReference: eventId ?? `order_created:${organizationId}:${sku}`,
        purchasedByUserId: userId,
        metadata: { priceUsd: addon.priceUsd },
      }, tx);
    }
  }

  private async reconcileOrderRefundedEvent(
    tx: {
      select: ReturnType<typeof getDb>["select"];
      insert: ReturnType<typeof getDb>["insert"];
      update: ReturnType<typeof getDb>["update"];
    },
    payload: LemonWebhookPayload,
  ): Promise<ReconcileOutcome> {
    const eventId = payload.data?.id ?? null;
    const customData = payload.meta?.custom_data ?? {};
    const organizationId = this.readString(customData.organization_id);
    const purchaseKind = this.readString(customData.purchase_kind);
    const sku = this.readString(customData.sku);
    if (organizationId && purchaseKind === "subscription" && eventId) {
      const notFullRefund = this.classifySubscriptionRefund(payload.data?.attributes ?? {});
      if (notFullRefund) return notFullRefund;
      // the subscription row stores LS attributes.order_id; orders carry no subscription_id
      return this.cancelRefundedSubscription(tx, organizationId, eq(subscriptions.providerOrderId, eventId));
    }
    if (!organizationId || !purchaseKind || !sku) {
      return { status: "ignored", reason: "missing_refund_metadata" };
    }

    const addon = resolveAddonSku(sku as BillingAddonSku);
    if (purchaseKind === "online_booking_topup") {
      const ledger = await this.getOrCreateVerifiedBookingLedger(tx, organizationId);
      const addonUsed = Math.max(0, ledger.used - ledger.includedGranted);
      const unusedAddonUnits = Math.max(0, ledger.addonGranted - addonUsed);
      if (unusedAddonUnits < addon.units) {
        await tx.insert(creditReconciliationEvents).values({
          organizationId,
          creditType: "verified_online_booking",
          month: ledger.month,
          eventType: "refund_review",
          includedBefore: ledger.includedGranted,
          includedAfter: ledger.includedGranted,
          addonBefore: ledger.addonGranted,
          addonAfter: ledger.addonGranted,
          usedBefore: ledger.used,
          usedAfter: ledger.used,
          providerEventId: eventId,
          metadata: { sku: addon.sku, refundedUnits: addon.units },
        });
        return { status: "processed" };
      }

      await tx
        .update(verifiedOnlineBookingCredits)
        .set({
          addonGranted: Math.max(0, ledger.addonGranted - addon.units),
          used: ledger.used,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(verifiedOnlineBookingCredits.organizationId, organizationId),
            eq(verifiedOnlineBookingCredits.month, ledger.month),
          ),
        );
      await this.markVerifiedBookingAddonRefunded(tx, organizationId, eventId, addon.units);

      await tx.insert(creditReconciliationEvents).values({
        organizationId,
        creditType: "verified_online_booking",
        month: ledger.month,
        eventType: "refund_applied",
        includedBefore: ledger.includedGranted,
        includedAfter: ledger.includedGranted,
        addonBefore: ledger.addonGranted,
        addonAfter: Math.max(0, ledger.addonGranted - addon.units),
        usedBefore: ledger.used,
        usedAfter: ledger.used,
        providerEventId: eventId,
        metadata: { sku: addon.sku, refundedUnits: addon.units },
      });
      return { status: "processed" };
    }

    if (purchaseKind === "sms_segment_topup") {
      const ledger = await this.getOrCreateSmsLedger(tx, organizationId);
      const addonUsed = Math.max(0, ledger.used - ledger.included);
      const unusedAddonUnits = Math.max(0, ledger.addon - addonUsed);
      if (unusedAddonUnits < addon.units) {
        await tx.insert(creditReconciliationEvents).values({
          organizationId,
          creditType: "sms_segment",
          month: ledger.month,
          eventType: "refund_review",
          includedBefore: ledger.included,
          includedAfter: ledger.included,
          addonBefore: ledger.addon,
          addonAfter: ledger.addon,
          usedBefore: ledger.used,
          usedAfter: ledger.used,
          providerEventId: eventId,
          metadata: { sku: addon.sku, refundedUnits: addon.units },
        });
        return { status: "processed" };
      }

      await tx
        .update(smsCredits)
        .set({
          addon: Math.max(0, ledger.addon - addon.units),
          used: ledger.used,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(smsCredits.organizationId, organizationId),
            eq(smsCredits.month, ledger.month),
          ),
        );
      await this.markSmsAddonRefunded(tx, organizationId, eventId, addon.units);

      await tx.insert(creditReconciliationEvents).values({
        organizationId,
        creditType: "sms_segment",
        month: ledger.month,
        eventType: "refund_applied",
        includedBefore: ledger.included,
        includedAfter: ledger.included,
        addonBefore: ledger.addon,
        addonAfter: Math.max(0, ledger.addon - addon.units),
        usedBefore: ledger.used,
        usedAfter: ledger.used,
        providerEventId: eventId,
        metadata: { sku: addon.sku, refundedUnits: addon.units },
      });
    }
    return { status: "processed" };
  }

  private async reconcileSubscriptionPaymentRefundedEvent(
    tx: {
      select: ReturnType<typeof getDb>["select"];
      update: ReturnType<typeof getDb>["update"];
    },
    payload: LemonWebhookPayload,
  ): Promise<ReconcileOutcome> {
    const organizationId = this.readString(payload.meta?.custom_data?.organization_id);
    const subscriptionId = this.readString(payload.data?.attributes?.subscription_id);
    if (!organizationId || !subscriptionId) {
      return { status: "ignored", reason: "missing_refund_metadata" };
    }
    const notFullRefund = this.classifySubscriptionRefund(payload.data?.attributes ?? {});
    if (notFullRefund) return notFullRefund;
    return this.cancelRefundedSubscription(tx, organizationId, eq(subscriptions.providerSubscriptionId, subscriptionId));
  }

  // Order and subscription-invoice status: "refunded" = full, "partial_refund" = partial. Only a full refund cancels.
  private classifySubscriptionRefund(attributes: Record<string, unknown>): ReconcileOutcome | null {
    const refundStatus = this.readString(attributes.status);
    if (refundStatus === "refunded") return null;
    if (refundStatus === "partial_refund") {
      return {
        status: "processed",
        reason: "partial_refund_review",
        metadata: { refundedAmount: attributes.refunded_amount ?? null },
      };
    }
    return { status: "ignored", reason: "refund_status_unrecognized" };
  }

  // Fully refunded subscription charge → cancel at period end. Replays must not cancel twice.
  private async cancelRefundedSubscription(
    tx: {
      select: ReturnType<typeof getDb>["select"];
      update: ReturnType<typeof getDb>["update"];
    },
    organizationId: string,
    match: SQL,
  ): Promise<ReconcileOutcome> {
    const [row] = await tx
      .select({
        id: subscriptions.id,
        providerSubscriptionId: subscriptions.providerSubscriptionId,
        status: subscriptions.status,
        cancelled: subscriptions.cancelled,
        billingInterval: subscriptions.billingInterval,
      })
      .from(subscriptions)
      .where(and(eq(subscriptions.organizationId, organizationId), eq(subscriptions.provider, "lemonsqueezy"), match))
      .limit(1);
    if (!row?.providerSubscriptionId) {
      return { status: "ignored", reason: "refunded_subscription_not_found" };
    }
    if (row.cancelled === "true" || row.status === "cancelled" || row.status === "expired") {
      return { status: "processed", reason: "subscription_already_cancelled" };
    }

    // LS does not document DELETE on an already-cancelled subscription, so check first.
    const provider = await this.lemonsqueezy.getSubscription(row.providerSubscriptionId);
    const providerAttributes = (provider.data?.attributes ?? {}) as Record<string, unknown>;
    const providerStatus = this.readString(providerAttributes.status);
    if (!this.readBoolean(providerAttributes.cancelled) && providerStatus !== "cancelled" && providerStatus !== "expired") {
      await this.lemonsqueezy.cancelSubscription(row.providerSubscriptionId);
    }

    await tx
      .update(subscriptions)
      .set({
        pendingSyncAction: "refund_cancel",
        pendingSyncStartedAt: new Date(),
        pendingSyncTargetPlanType: "free",
        pendingSyncTargetBillingInterval: row.billingInterval,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, row.id));
    return { status: "processed", reason: "refund_cancelled_subscription" };
  }

  // Email and SMS ledger rows are created with the plan active at first use; a plan change must update them or the old allowance sticks for the month.
  private async syncIncludedMonthlyAllowances(
    tx: {
      select: ReturnType<typeof getDb>["select"];
      insert: ReturnType<typeof getDb>["insert"];
      update: ReturnType<typeof getDb>["update"];
    },
    organizationId: string,
    planType: Exclude<PlanType, "free">,
  ): Promise<void> {
    const month = this.getCurrentMonthUtcKey();
    const included = getPlanCatalogEntry(planType).limits.emailMessagesPerMonth;
    const [existing] = await tx
      .select({ id: emailCredits.id, included: emailCredits.included })
      .from(emailCredits)
      .where(and(eq(emailCredits.organizationId, organizationId), eq(emailCredits.month, month)))
      .limit(1);

    if (!existing) {
      await tx.insert(emailCredits).values({ organizationId, month, included, used: 0 });
    } else if (existing.included !== included) {
      await tx
        .update(emailCredits)
        .set({ included, updatedAt: new Date() })
        .where(eq(emailCredits.id, existing.id));
    }

    await this.syncIncludedSmsCredits(tx, organizationId, month, SMS_INCLUDED_BY_PLAN[planType]);
  }

  // Only `included` follows the plan; addon, used, and pausedReason are left as-is.
  private async syncIncludedSmsCredits(
    tx: {
      select: ReturnType<typeof getDb>["select"];
      insert: ReturnType<typeof getDb>["insert"];
      update: ReturnType<typeof getDb>["update"];
    },
    organizationId: string,
    month: string,
    included: number,
  ): Promise<void> {
    const [existing] = await tx
      .select({ id: smsCredits.id, included: smsCredits.included })
      .from(smsCredits)
      .where(and(eq(smsCredits.organizationId, organizationId), eq(smsCredits.month, month)))
      .limit(1);

    if (!existing) {
      await tx.insert(smsCredits).values({ organizationId, month, included, addon: 0, used: 0 });
      return;
    }
    if (existing.included !== included) {
      await tx
        .update(smsCredits)
        .set({ included, updatedAt: new Date() })
        .where(eq(smsCredits.id, existing.id));
    }
  }

  private async reconcileIncludedBookingCredits(
    tx: {
      select: ReturnType<typeof getDb>["select"];
      insert: ReturnType<typeof getDb>["insert"];
      update: ReturnType<typeof getDb>["update"];
    },
    input: {
      organizationId: string;
      eventId: string | null;
      planType: Exclude<PlanType, "free">;
      currentPeriodStart: Date;
    },
  ): Promise<void> {
    const month = this.toMonthKey(input.currentPeriodStart);
    const includedTarget = getPlanCatalogEntry(input.planType).limits.verifiedOnlineBookingsPerMonth;
    const [existingCredits] = await tx
      .select()
      .from(verifiedOnlineBookingCredits)
      .where(
        and(
          eq(verifiedOnlineBookingCredits.organizationId, input.organizationId),
          eq(verifiedOnlineBookingCredits.month, month),
        ),
      )
      .limit(1);

    if (!existingCredits) {
      await tx.insert(verifiedOnlineBookingCredits).values({
        organizationId: input.organizationId,
        month,
        includedGranted: includedTarget,
        addonGranted: 0,
        used: 0,
        sourcePlan: input.planType,
        lastReconciledAt: new Date(),
      });
      return;
    }

    const nextCredits = applyMonthlyIncludedUpgrade(
      {
        organizationId: input.organizationId,
        month: existingCredits.month,
        includedGranted: existingCredits.includedGranted,
        addonGranted: existingCredits.addonGranted,
        used: existingCredits.used,
        sourcePlan: existingCredits.sourcePlan,
      },
      {
        nextPlan: input.planType,
        nextIncluded: includedTarget,
      },
    );

    if (
      nextCredits.includedGranted === existingCredits.includedGranted &&
      nextCredits.sourcePlan === existingCredits.sourcePlan
    ) {
      return;
    }

    await tx
      .update(verifiedOnlineBookingCredits)
      .set({
        includedGranted: nextCredits.includedGranted,
        used: existingCredits.used,
        sourcePlan: nextCredits.sourcePlan,
        lastReconciledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(verifiedOnlineBookingCredits.organizationId, input.organizationId),
          eq(verifiedOnlineBookingCredits.month, month),
        ),
      );

    await tx.insert(creditReconciliationEvents).values({
      organizationId: input.organizationId,
      creditType: "verified_online_booking",
      month: existingCredits.month,
      eventType: "subscription_upgrade",
      previousPlan: existingCredits.sourcePlan,
      nextPlan: input.planType,
      includedBefore: existingCredits.includedGranted,
      includedAfter: nextCredits.includedGranted,
      addonBefore: existingCredits.addonGranted,
      addonAfter: existingCredits.addonGranted,
      usedBefore: existingCredits.used,
      usedAfter: existingCredits.used,
      providerEventId: input.eventId,
    });
  }

  private async getVerifiedBookingLedger(organizationId: string) {
    const db = getDb();
    const month = this.getCurrentMonthUtcKey();
    const [ledger] = await db
      .select()
      .from(verifiedOnlineBookingCredits)
      .where(
        and(
          eq(verifiedOnlineBookingCredits.organizationId, organizationId),
          eq(verifiedOnlineBookingCredits.month, month),
        ),
      )
      .limit(1);
    return ledger ?? null;
  }

  private async getSmsLedger(organizationId: string) {
    const db = getDb();
    const month = this.getCurrentMonthUtcKey();
    const [ledger] = await db
      .select()
      .from(smsCredits)
      .where(
        and(
          eq(smsCredits.organizationId, organizationId),
          eq(smsCredits.month, month),
        ),
      )
      .limit(1);
    return ledger ?? null;
  }

  private async getEmailLedger(organizationId: string) {
    const db = getDb();
    const month = this.getCurrentMonthUtcKey();
    const [ledger] = await db
      .select()
      .from(emailCredits)
      .where(
        and(
          eq(emailCredits.organizationId, organizationId),
          eq(emailCredits.month, month),
        ),
      )
      .limit(1);
    return ledger ?? null;
  }

  private async getAiRequestsUsed(organizationId: string) {
    const db = getDb();
    const [summary] = await db
      .select({
        totalRequests: sql<number>`count(*)::int`,
      })
      .from(aiUsageEvents)
      .where(eq(aiUsageEvents.organizationId, organizationId))
      .limit(1);
    return Number(summary?.totalRequests ?? 0);
  }

  private async buildOwnerWarnings(
    organizationId: string,
    subscription: Awaited<ReturnType<BillingService["getSubscription"]>>,
  ) {
    const db = getDb();
    const [refundReview] = await db
      .select()
      .from(creditReconciliationEvents)
      .where(eq(creditReconciliationEvents.organizationId, organizationId))
      .limit(1);

    const warnings: Array<{
      code: string;
      severity: "warning";
      message: string;
      createdAt?: string;
      metadata?: Record<string, unknown> | null;
    }> = [];

    if (refundReview?.eventType === "refund_review" && !refundReview.resolvedAt) {
      warnings.push({
        code: "refund_review",
        severity: "warning" as const,
        message:
          "A refunded add-on needs manual review before balances can be finalized.",
        createdAt:
          refundReview.createdAt instanceof Date
            ? refundReview.createdAt.toISOString()
            : undefined,
        metadata:
          refundReview.metadata && typeof refundReview.metadata === "object"
            ? (refundReview.metadata as Record<string, unknown>)
            : null,
      });
    }

    if (
      subscription?.pendingSyncStartedAt instanceof Date &&
      Date.now() - subscription.pendingSyncStartedAt.getTime() >= 120_000
    ) {
      warnings.push({
        code: "delayed_webhook_sync",
        severity: "warning" as const,
        message:
          "Billing changes are still waiting for webhook reconciliation. Refresh shortly if this warning persists.",
        createdAt: subscription.pendingSyncStartedAt.toISOString(),
        metadata: {
          pendingSyncAction: subscription.pendingSyncAction ?? null,
          pendingSyncTargetPlanType: subscription.pendingSyncTargetPlanType ?? null,
          pendingSyncTargetBillingInterval:
            subscription.pendingSyncTargetBillingInterval ?? null,
        },
      });
    }

    return warnings;
  }

  private async getOrCreateVerifiedBookingLedger(
    tx: {
      select: ReturnType<typeof getDb>["select"];
      insert: ReturnType<typeof getDb>["insert"];
    },
    organizationId: string,
  ) {
    const [ledger] = await tx
      .select()
      .from(verifiedOnlineBookingCredits)
      .where(
        and(
          eq(verifiedOnlineBookingCredits.organizationId, organizationId),
          eq(verifiedOnlineBookingCredits.month, this.getCurrentMonthUtcKey()),
        ),
      )
      .limit(1);
    if (ledger) return ledger;

    const nextLedger = {
      organizationId,
      month: this.getCurrentMonthUtcKey(),
      includedGranted: 0,
      addonGranted: 0,
      used: 0,
      sourcePlan: "free" as const,
      lastReconciledAt: new Date(),
    };
    await tx.insert(verifiedOnlineBookingCredits).values(nextLedger);
    return nextLedger;
  }

  private async getOrCreateSmsLedger(
    tx: {
      select: ReturnType<typeof getDb>["select"];
      insert: ReturnType<typeof getDb>["insert"];
    },
    organizationId: string,
  ) {
    const [ledger] = await tx
      .select()
      .from(smsCredits)
      .where(
        and(
          eq(smsCredits.organizationId, organizationId),
          eq(smsCredits.month, this.getCurrentMonthUtcKey()),
        ),
      )
      .limit(1);
    if (ledger) return ledger;

    const [org] = await tx
      .select({ currentPlan: organizations.currentPlan })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    const nextLedger = {
      organizationId,
      month: this.getCurrentMonthUtcKey(),
      included: SMS_INCLUDED_BY_PLAN[org?.currentPlan ?? "free"],
      addon: 0,
      used: 0,
      pausedReason: "none" as const,
    };
    await tx.insert(smsCredits).values(nextLedger);
    return nextLedger;
  }

  private isLiveLemonSubscription(row: { status: string; endsAt?: Date | null }, now = new Date()): boolean {
    if ((LIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(row.status)) return true;
    return row.status === "cancelled" && !!row.endsAt && row.endsAt.getTime() > now.getTime();
  }

  private async findLiveLemonSubscriptionId(
    db: { select: ReturnType<typeof getDb>["select"] },
    organizationId: string,
    excludeProviderSubscriptionId?: string | null,
  ): Promise<string | null> {
    const [row] = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.organizationId, organizationId),
          eq(subscriptions.provider, "lemonsqueezy"),
          or(
            inArray(subscriptions.status, [...LIVE_SUBSCRIPTION_STATUSES]),
            and(eq(subscriptions.status, "cancelled"), gt(subscriptions.endsAt, new Date())),
          ),
          excludeProviderSubscriptionId
            ? ne(subscriptions.providerSubscriptionId, excludeProviderSubscriptionId)
            : undefined,
        ),
      )
      .limit(1);
    return row?.id ?? null;
  }

  private resolvePlanType(value: string | null, fallback: PlanType): PlanType {
    if (value === "free" || value === "starter" || value === "growth" || value === "pro") {
      return value;
    }
    return fallback;
  }

  private resolvePlanFromVariantId(
    variantId: string | null,
  ): { planType: Exclude<PlanType, "free">; billingInterval: BillingInterval } | null {
    if (!variantId) return null;
    const candidates: Array<{ planType: Exclude<PlanType, "free">; billingInterval: BillingInterval }> = [
      { planType: "starter", billingInterval: "monthly" },
      { planType: "starter", billingInterval: "annual" },
      { planType: "growth", billingInterval: "monthly" },
      { planType: "growth", billingInterval: "annual" },
      { planType: "pro", billingInterval: "monthly" },
      { planType: "pro", billingInterval: "annual" },
    ];

    for (const candidate of candidates) {
      const envKey = resolveSubscriptionVariantEnvKey(
        candidate.planType,
        candidate.billingInterval,
      );
      if (process.env[envKey]?.trim() === variantId) {
        return candidate;
      }
    }

    return null;
  }

  private resolveBillingInterval(
    value: string | null,
    fallback: BillingInterval | null,
  ): BillingInterval | null {
    if (value === "monthly" || value === "annual") return value;
    return fallback;
  }

  private resolveSubscriptionStatus(
    eventName: string,
    attributeStatus: string | null,
  ): SubscriptionStatus {
    if (attributeStatus === "active" || attributeStatus === "cancelled" || attributeStatus === "past_due" || attributeStatus === "trialing" || attributeStatus === "paused" || attributeStatus === "expired" || attributeStatus === "unpaid") {
      return attributeStatus;
    }

    if (eventName === "subscription_cancelled") return "cancelled";
    if (eventName === "subscription_expired") return "expired";
    if (eventName === "subscription_paused") return "paused";
    return "active";
  }

  private mapOrgBillingStatus(status: SubscriptionStatus, endsAt: Date | null) {
    if (status === "trialing") return "trial_active" as const;
    if (status === "past_due" || status === "unpaid") return "subscription_past_due" as const;
    if (status === "paused") return "subscription_paused" as const;
    if (status === "expired") return "subscription_expired" as const;
    if (status === "cancelled") {
      return endsAt && endsAt.getTime() > Date.now()
        ? ("subscription_cancelled" as const)
        : ("subscription_expired" as const);
    }
    return "subscription_active" as const;
  }

  private readString(value: unknown): string | null {
    if (typeof value === "string") {
      return value.trim() || null;
    }
    if (typeof value === "number") {
      return String(value);
    }
    return null;
  }

  private readBoolean(value: unknown): boolean {
    return value === true || value === "true";
  }

  private parseDate(value: unknown): Date | null {
    const raw = this.readString(value);
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private subtractBillingInterval(periodEnd: Date, interval: BillingInterval): Date {
    const start = new Date(periodEnd);
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth() - (interval === "annual" ? 12 : 1));
    // clamp so a Mar 31 renewal starts Feb 28/29 instead of rolling into March
    const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
    start.setUTCDate(Math.min(periodEnd.getUTCDate(), lastDay));
    return start;
  }

  private getCurrentMonthUtcKey(): string {
    return this.toMonthKey(new Date());
  }

  private toMonthKey(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  private clearPendingSync() {
    return {
      pendingSyncAction: null,
      pendingSyncStartedAt: null,
      pendingSyncTargetPlanType: null,
      pendingSyncTargetBillingInterval: null,
    };
  }

  private async markVerifiedBookingAddonRefunded(
    tx: {
      select: ReturnType<typeof getDb>["select"];
      update: ReturnType<typeof getDb>["update"];
    },
    organizationId: string,
    orderId: string | null,
    units: number,
  ) {
    // Match the refunded order itself; several packs can share a sku, so sku alone marks the wrong purchase.
    if (!orderId) return;
    const [addon] = await tx
      .select({ id: verifiedOnlineBookingAddons.id })
      .from(verifiedOnlineBookingAddons)
      .where(
        and(
          eq(verifiedOnlineBookingAddons.organizationId, organizationId),
          eq(verifiedOnlineBookingAddons.source, "lemonsqueezy"),
          eq(verifiedOnlineBookingAddons.sourceReference, orderId),
        ),
      )
      .limit(1);
    if (!addon?.id) return;

    await tx
      .update(verifiedOnlineBookingAddons)
      .set({
        refundedUnits: units,
      })
      .where(eq(verifiedOnlineBookingAddons.id, addon.id));
  }

  private async markSmsAddonRefunded(
    tx: {
      select: ReturnType<typeof getDb>["select"];
      update: ReturnType<typeof getDb>["update"];
    },
    organizationId: string,
    orderId: string | null,
    units: number,
  ) {
    // Match the refunded order itself; several packs can share a size, so size alone marks the wrong purchase.
    if (!orderId) return;
    const [addon] = await tx
      .select({ id: smsAddons.id })
      .from(smsAddons)
      .where(
        and(
          eq(smsAddons.organizationId, organizationId),
          eq(smsAddons.source, "lemonsqueezy"),
          eq(smsAddons.sourceReference, orderId),
        ),
      )
      .limit(1);
    if (!addon?.id) return;

    await tx
      .update(smsAddons)
      .set({
        refundedUnits: units,
      })
      .where(eq(smsAddons.id, addon.id));
  }

  private async markPendingSync(
    subscriptionId: string,
    input: {
      action: string;
      targetPlanType: PlanType | null;
      targetBillingInterval: BillingInterval | null;
    },
  ) {
    const db = getDb();
    await db
      .update(subscriptions)
      .set({
        pendingSyncAction: input.action,
        pendingSyncStartedAt: new Date(),
        pendingSyncTargetPlanType: input.targetPlanType,
        pendingSyncTargetBillingInterval: input.targetBillingInterval,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscriptionId));
  }

  private resolveSubscriptionInterval(
    subscription: Awaited<ReturnType<BillingService["getSubscription"]>>,
  ): BillingInterval | null {
    const interval = subscription?.billingInterval;
    return interval === "monthly" || interval === "annual" ? interval : null;
  }

  private isScheduledDowngrade(
    currentPlan: PlanType,
    currentInterval: BillingInterval,
    nextPlan: Exclude<PlanType, "free">,
    nextInterval: BillingInterval,
  ): boolean {
    return this.planRank(nextPlan, nextInterval) < this.planRank(currentPlan, currentInterval);
  }

  // Tier decides; within a tier annual ranks above monthly, so monthly→annual is an immediate upgrade.
  private planRank(planType: PlanType, interval: BillingInterval): number {
    return PLAN_TIER_RANK[planType] * 2 + (interval === "annual" ? 1 : 0);
  }
}
