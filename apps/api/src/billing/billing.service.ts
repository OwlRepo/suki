import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { getDb } from "@tyvera/database";
import {
  creditReconciliationEvents,
  organizations,
  processedWebhookEvents,
  subscriptions,
  verifiedOnlineBookingCredits,
} from "@tyvera/database";
import { and, desc, eq } from "drizzle-orm";
import { createHash } from "crypto";
import type { BillingInterval, PlanType } from "@tyvera/types";
import { LemonsqueezyService } from "./lemonsqueezy.service";
import { applyMonthlyIncludedUpgrade } from "./credit-reconciliation";
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
    const verifiedOnlineBookingCredits = {
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
    const url =
      subscription?.customerPortalUrl ?? subscription?.updatePaymentMethodUrl;
    if (!url) {
      throw new NotFoundException("Billing portal is not available for this account.");
    }
    return { url };
  }

  async changePlan(
    organizationId: string,
    input: { planType: PlanType; billingInterval?: BillingInterval },
  ) {
    const subscription = await this.getSubscription(organizationId);
    return {
      organizationId,
      subscriptionId: subscription?.id ?? null,
      scheduled: true,
      planType: input.planType,
      billingInterval: input.billingInterval ?? null,
    };
  }

  async cancel(organizationId: string) {
    const subscription = await this.getSubscription(organizationId);
    return {
      organizationId,
      subscriptionId: subscription?.id ?? null,
      cancellationScheduled: true,
      endsAt: subscription?.endsAt?.toISOString() ?? null,
    };
  }

  async resume(organizationId: string) {
    const subscription = await this.getSubscription(organizationId);
    return {
      organizationId,
      subscriptionId: subscription?.id ?? null,
      resumed: true,
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
    const planType = this.resolvePlanType(
      rawPlanType,
      existingSubscription?.planType ?? "free",
    );
    const billingInterval = this.resolveBillingInterval(
      this.readString(customData.billing_interval),
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
    const nextOrgPlan = status === "expired" ? "free" : planType;
    const planPricePhp =
      nextOrgPlan === "free" ? 0 : getPlanCatalogEntry(nextOrgPlan).monthlyPricePhp;

    const subscriptionValues = {
      organizationId,
      planType,
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
      billingInterval,
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

    if (nextOrgPlan !== "free" && status !== "expired") {
      await this.reconcileIncludedBookingCredits(tx, {
        organizationId,
        eventId,
        planType: nextOrgPlan,
        currentPeriodStart,
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

  private resolvePlanType(value: string | null, fallback: PlanType): PlanType {
    if (value === "free" || value === "starter" || value === "growth" || value === "pro") {
      return value;
    }
    return fallback;
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
}
