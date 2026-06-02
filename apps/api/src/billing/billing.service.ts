import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { getDb } from "@tyvera/database";
import {
  creditReconciliationEvents,
  organizations,
  processedWebhookEvents,
  smsAddons,
  subscriptions,
  verifiedOnlineBookingAddons,
  verifiedOnlineBookingCredits,
} from "@tyvera/database";
import { and, desc, eq } from "drizzle-orm";
import { createHash } from "crypto";
import type { BillingInterval, PlanType } from "@tyvera/types";
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
} from "./plan-catalog";

type AddonSku =
  | "online-booking-topup-10"
  | "online-booking-topup-25"
  | "online-booking-topup-50"
  | "online-booking-topup-100"
  | "online-booking-topup-250"
  | "sms-segment-topup-25"
  | "sms-segment-topup-50"
  | "sms-segment-topup-100"
  | "sms-segment-topup-250";

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

@Injectable()
export class BillingService {
  constructor(private readonly lemonsqueezy: LemonsqueezyService) {}

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

  getPlansResponse(input: { checkoutEnabled: boolean }) {
    return {
      checkoutEnabled: input.checkoutEnabled,
      plans: ["free", "starter", "growth", "pro"].map((planType) => {
        const entry = getPlanCatalogEntry(planType as PlanType);
        return entry;
      }),
    };
  }

  async getBillingStatus(organizationId: string) {
    const subscription = await this.getSubscription(organizationId);
    const fallbackPlanType = subscription?.planType ?? "free";
    const plan = getPlanCatalogEntry(fallbackPlanType);
    const ledger = await this.getVerifiedBookingLedger(organizationId);
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
        subscription: null,
      };
    }

    return {
      planType: subscription.planType,
      billingInterval: subscription.billingInterval,
      billingStatus:
        subscription.status === "past_due"
          ? "subscription_past_due"
          : subscription.status === "cancelled"
            ? "subscription_cancelled"
            : subscription.status === "expired"
              ? "subscription_expired"
              : subscription.status === "paused"
                ? "subscription_paused"
                : "subscription_active",
      cancellationPending: subscription.cancelled === "true",
      scheduledPlanType: subscription.scheduledPlanType ?? null,
      scheduledBillingInterval: subscription.scheduledBillingInterval ?? null,
      scheduledChangeEffectiveAt:
        subscription.scheduledChangeEffectiveAt?.toISOString() ?? null,
      renewsAt: subscription.renewsAt?.toISOString() ?? null,
      endsAt: subscription.endsAt?.toISOString() ?? null,
      verifiedOnlineBookingCredits,
      subscription,
    };
  }

  async createSubscriptionCheckout(input: {
    organizationId: string;
    userId: string;
    planType: Exclude<PlanType, "free">;
    billingInterval: BillingInterval;
  }) {
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
    sku: AddonSku;
  }) {
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
    const subscription = await this.getSubscription(organizationId);
    if (!subscription?.providerSubscriptionId) {
      throw new NotFoundException("Subscription not found.");
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
    const subscription = await this.getSubscription(organizationId);
    if (!subscription?.providerSubscriptionId) {
      throw new NotFoundException("Subscription not found.");
    }

    const providerResponse = await this.lemonsqueezy.cancelSubscription(
      subscription.providerSubscriptionId,
    );
    const endsAt = this.parseDate(providerResponse.data?.attributes?.ends_at);

    const db = getDb();
    await db
      .update(subscriptions)
      .set({
        cancelled: "true",
        status: "cancelled",
        endsAt,
        renewsAt: this.parseDate(providerResponse.data?.attributes?.renews_at),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id));

    return {
      organizationId,
      subscriptionId: subscription.id ?? null,
      cancellationScheduled: true,
      pendingWebhookSync: true,
      endsAt: endsAt?.toISOString() ?? null,
    };
  }

  async resume(organizationId: string) {
    const subscription = await this.getSubscription(organizationId);
    if (!subscription?.providerSubscriptionId) {
      throw new NotFoundException("Subscription not found.");
    }

    const providerResponse = await this.lemonsqueezy.updateSubscription(
      subscription.providerSubscriptionId,
      {
        cancelled: false,
      },
    );

    const db = getDb();
    await db
      .update(subscriptions)
      .set({
        cancelled: "false",
        status: this.resolveSubscriptionStatus(
          "subscription_resumed",
          this.readString(providerResponse.data?.attributes?.status),
        ),
        endsAt: this.parseDate(providerResponse.data?.attributes?.ends_at),
        renewsAt: this.parseDate(providerResponse.data?.attributes?.renews_at),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id));

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

  async reconcileWebhookEvent(payload: LemonWebhookPayload): Promise<void> {
    const eventId = payload.data?.id;
    const eventName = payload.meta?.event_name ?? "unknown";
    if (!eventId) return;

    const db = getDb();
    await db.transaction(async (tx) => {
      if (eventName.startsWith("subscription_")) {
        await this.reconcileSubscriptionEvent(tx, payload);
      } else if (eventName === "order_created") {
        await this.reconcileOrderCreatedEvent(tx, payload);
      }

      await tx.insert(processedWebhookEvents).values({
        provider: "lemonsqueezy",
        eventId,
        eventName,
        payloadHash: createHash("sha256")
          .update(JSON.stringify(payload))
          .digest("hex"),
        status: "processed",
      });
    });
  }

  private getRequiredEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value || value.toLowerCase().includes("placeholder")) {
      throw new ServiceUnavailableException(
        `Billing configuration missing required value: ${name}`,
      );
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
  ): Promise<void> {
    const eventName = payload.meta?.event_name ?? "subscription_updated";
    const eventId = payload.data?.id ?? null;
    const attributes = payload.data?.attributes ?? {};
    const customData = payload.meta?.custom_data ?? {};
    const organizationId = this.readString(customData.organization_id);
    if (!organizationId) {
      return;
    }

    const [existingSubscription] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .orderBy(desc(subscriptions.currentPeriodEnd))
      .limit(1);

    const rawPlanType = this.readString(customData.plan_type);
    const variantPlan = this.resolvePlanFromVariantId(
      this.readString(attributes.variant_id),
    );
    const planType = this.resolvePlanType(
      rawPlanType ?? variantPlan?.planType ?? null,
      existingSubscription?.planType ?? "free",
    );
    const billingInterval = this.resolveBillingInterval(
      this.readString(customData.billing_interval) ?? variantPlan?.billingInterval ?? null,
      (existingSubscription?.billingInterval as BillingInterval | null) ?? null,
    );
    const status = this.resolveSubscriptionStatus(
      eventName,
      this.readString(attributes.status),
    );
    const currentPeriodStart =
      this.parseDate(attributes.current_period_start) ??
      existingSubscription?.currentPeriodStart ??
      new Date();
    const currentPeriodEnd =
      this.parseDate(attributes.current_period_end) ??
      existingSubscription?.currentPeriodEnd ??
      currentPeriodStart;
    const renewsAt = this.parseDate(attributes.renews_at);
    const endsAt = this.parseDate(attributes.ends_at);
    const trialEndsAt = this.parseDate(attributes.trial_ends_at);
    const cancelled = this.readBoolean(attributes.cancelled)
      ? "true"
      : status === "cancelled" || status === "expired"
        ? "true"
        : "false";
    const urls = (attributes.urls ?? {}) as Record<string, unknown>;
    const scheduledDowngrade =
      !!existingSubscription &&
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
      ? existingSubscription?.planType
      : planType;
    const nextOrgPlan = status === "expired" ? "free" : appliedPlanType;
    const planPricePhp = this.priceForPlan(
      status === "expired" ? "free" : planType,
      billingInterval,
    );

    const subscriptionValues = {
      organizationId,
      planType: appliedPlanType,
      status,
      provider: "lemonsqueezy" as const,
      providerSubscriptionId: payload.data?.id ?? existingSubscription?.providerSubscriptionId ?? null,
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
      cardBrand: this.readString(attributes.card_brand),
      cardLastFour: this.readString(attributes.card_last_four),
      updatePaymentMethodUrl: this.readString(urls.update_payment_method),
      customerPortalUrl: this.readString(urls.customer_portal),
      lastProviderEventId: eventId,
      planPricePhp,
      scheduledPlanType: scheduledDowngrade ? planType : null,
      scheduledBillingInterval: scheduledDowngrade ? billingInterval : null,
      scheduledChangeEffectiveAt: scheduledDowngrade
        ? renewsAt ?? currentPeriodEnd
        : null,
    };

    if (existingSubscription?.id) {
      await tx
        .update(subscriptions)
        .set(subscriptionValues)
        .where(eq(subscriptions.id, existingSubscription.id));
    } else {
      await tx.insert(subscriptions).values(subscriptionValues);
    }

    await tx
      .update(organizations)
      .set({
        currentPlan: nextOrgPlan,
        billingStatus: this.mapOrgBillingStatus(status, endsAt),
        nextBillingDueAt: renewsAt,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId));

    if (!scheduledDowngrade && nextOrgPlan !== "free" && status !== "expired") {
      await this.reconcileIncludedBookingCredits(tx, {
        organizationId,
        eventId,
        planType: nextOrgPlan,
        currentPeriodStart,
      });
    }
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

    const addon = resolveAddonSku(sku as AddonSku);
    if (purchaseKind === "online_booking_topup") {
      const ledger = await this.getOrCreateVerifiedBookingLedger(
        tx,
        organizationId,
      );
      await tx
        .update(verifiedOnlineBookingCredits)
        .set({
          addonGranted: ledger.addonGranted + addon.units,
          used: ledger.used,
          updatedAt: new Date(),
        })
        .where(eq(verifiedOnlineBookingCredits.organizationId, organizationId));
      await tx.insert(verifiedOnlineBookingAddons).values({
        organizationId,
        units: addon.units,
        pricePhp: addon.pricePhp,
        sku: addon.sku,
        providerOrderId: eventId,
        purchasedByUserId: userId,
      });
      return;
    }

    if (purchaseKind === "sms_segment_topup") {
      await tx.insert(smsAddons).values({
        organizationId,
        packSize: addon.units,
        packPricePhp: addon.pricePhp,
        purchasedByUserId: userId,
      });
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
      .where(eq(verifiedOnlineBookingCredits.organizationId, input.organizationId))
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
      .where(eq(verifiedOnlineBookingCredits.organizationId, input.organizationId));

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
    const [ledger] = await db
      .select()
      .from(verifiedOnlineBookingCredits)
      .where(eq(verifiedOnlineBookingCredits.organizationId, organizationId))
      .limit(1);
    return ledger ?? null;
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
      .where(eq(verifiedOnlineBookingCredits.organizationId, organizationId))
      .limit(1);
    if (ledger) return ledger;

    const nextLedger = {
      organizationId,
      month: this.toMonthKey(new Date()),
      includedGranted: 0,
      addonGranted: 0,
      used: 0,
      sourcePlan: "free" as const,
      lastReconciledAt: new Date(),
    };
    await tx.insert(verifiedOnlineBookingCredits).values(nextLedger);
    return nextLedger;
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

    if (eventName === "subscription_payment_failed") return "past_due";
    if (eventName === "subscription_cancelled") return "cancelled";
    if (eventName === "subscription_expired") return "expired";
    if (eventName === "subscription_paused") return "paused";
    return "active";
  }

  private mapOrgBillingStatus(status: SubscriptionStatus, endsAt: Date | null) {
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

  private toMonthKey(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
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
    return this.priceForPlan(currentPlan, currentInterval) > this.priceForPlan(nextPlan, nextInterval);
  }

  private priceForPlan(planType: PlanType, interval: BillingInterval | null | undefined): number {
    if (planType === "free") return 0;
    const plan = getPlanCatalogEntry(planType);
    if (interval === "annual") {
      return plan.annualPricePhp ?? plan.monthlyPricePhp;
    }
    return plan.monthlyPricePhp;
  }
}
