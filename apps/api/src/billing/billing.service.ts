import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { getDb } from "@tyvera/database";
import {
  processedWebhookEvents,
  subscriptions,
} from "@tyvera/database";
import { and, desc, eq } from "drizzle-orm";
import type { BillingInterval, PlanType } from "@tyvera/types";
import { LemonsqueezyService } from "./lemonsqueezy.service";
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
}
