import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import type {
  BillingInterval,
  BillingPurchaseKind,
  PlanType,
} from "@tyvera/types";

const LEMONSQUEEZY_API = "https://api.lemonsqueezy.com/v1";

export interface CreateCheckoutInput {
  variantId: string;
  organizationId: string;
  userId: string;
  purchaseKind: BillingPurchaseKind;
  planType?: Exclude<PlanType, "free">;
  billingInterval?: BillingInterval;
  sku?: string;
  productLabel: string;
  successUrl: string;
  cancelUrl: string;
}

export interface UpdateSubscriptionInput {
  variantId?: string;
  cancelled?: boolean;
  invoiceImmediately?: boolean;
  disableProrations?: boolean;
}

export interface LemonSubscriptionResponse {
  data?: {
    id?: string;
    attributes?: {
      status?: string;
      ends_at?: string | null;
      renews_at?: string | null;
      current_period_start?: string | null;
      current_period_end?: string | null;
      trial_ends_at?: string | null;
      variant_id?: number | string | null;
      product_id?: number | string | null;
      customer_id?: number | string | null;
      order_id?: number | string | null;
      card_brand?: string | null;
      card_last_four?: string | null;
      cancelled?: boolean | null;
      first_subscription_item?: { id?: number | string | null } | null;
      urls?: {
        customer_portal?: string | null;
        update_payment_method?: string | null;
        customer_portal_update_subscription?: string | null;
      };
    };
  };
}

@Injectable()
export class LemonsqueezyService {
  private readonly apiKey: string | null;
  private readonly storeId: string | null;
  private readonly webhookSecret: string | null;

  constructor() {
    this.apiKey = process.env.LEMONSQUEEZY_API_KEY?.trim() || null;
    this.storeId = process.env.LEMONSQUEEZY_STORE_ID?.trim() || null;
    this.webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim() || null;
  }

  verifyWebhookSignature(payload: string | Buffer, signature: string | undefined): boolean {
    if (!this.webhookSecret || !signature) {
      return false;
    }
    const expected = createHmac("sha256", this.webhookSecret)
      .update(payload)
      .digest("hex");

    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(signature);
    if (expectedBuf.length !== actualBuf.length) {
      return false;
    }
    return timingSafeEqual(expectedBuf, actualBuf);
  }

  async createCheckout(input: CreateCheckoutInput): Promise<{ checkoutUrl: string }> {
    if (!this.apiKey || !this.storeId) {
      throw new ServiceUnavailableException(
        "Lemon Squeezy is not configured. Set LEMONSQUEEZY_API_KEY and LEMONSQUEEZY_STORE_ID.",
      );
    }

    const response = await fetch(`${LEMONSQUEEZY_API}/checkouts`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            checkout_data: {
              custom: {
                organization_id: input.organizationId,
                user_id: input.userId,
                purchase_kind: input.purchaseKind,
                ...(input.planType ? { plan_type: input.planType } : {}),
                ...(input.billingInterval
                  ? { billing_interval: input.billingInterval }
                  : {}),
                ...(input.sku ? { sku: input.sku } : {}),
              },
            },
            checkout_options: {
              embed: false,
            },
            product_options: {
              enabled_variants: [Number(input.variantId)],
              redirect_url: input.successUrl,
              receipt_button_text: "Back to Tyvera",
              receipt_link_url: input.successUrl,
            },
          },
          relationships: {
            store: {
              data: {
                type: "stores",
                id: this.storeId,
              },
            },
            variant: {
              data: {
                type: "variants",
                id: input.variantId,
              },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Lemon Squeezy checkout failed with status ${response.status}.`,
      );
    }

    const payload = (await response.json()) as {
      data?: {
        attributes?: {
          url?: string;
        };
      };
    };
    const checkoutUrl = payload.data?.attributes?.url;
    if (!checkoutUrl) {
      throw new ServiceUnavailableException(
        "Lemon Squeezy did not return a checkout URL.",
      );
    }

    return { checkoutUrl };
  }

  async getSubscription(subscriptionId: string): Promise<LemonSubscriptionResponse> {
    return this.requestJson<LemonSubscriptionResponse>(
      `${LEMONSQUEEZY_API}/subscriptions/${subscriptionId}`,
      {
        method: "GET",
      },
      "retrieve subscription",
    );
  }

  async updateSubscription(
    subscriptionId: string,
    input: UpdateSubscriptionInput,
  ): Promise<LemonSubscriptionResponse> {
    return this.requestJson<LemonSubscriptionResponse>(
      `${LEMONSQUEEZY_API}/subscriptions/${subscriptionId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          data: {
            type: "subscriptions",
            id: subscriptionId,
            attributes: {
              ...(input.variantId ? { variant_id: Number(input.variantId) } : {}),
              ...(input.cancelled !== undefined ? { cancelled: input.cancelled } : {}),
              ...(input.invoiceImmediately ? { invoice_immediately: true } : {}),
              ...(input.disableProrations ? { disable_prorations: true } : {}),
            },
          },
        }),
      },
      "update subscription",
    );
  }

  async cancelSubscription(subscriptionId: string): Promise<LemonSubscriptionResponse> {
    return this.requestJson<LemonSubscriptionResponse>(
      `${LEMONSQUEEZY_API}/subscriptions/${subscriptionId}`,
      {
        method: "DELETE",
      },
      "cancel subscription",
    );
  }

  private async requestJson<T>(
    url: string,
    init: RequestInit,
    action: string,
  ): Promise<T> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        "Lemon Squeezy is not configured. Set LEMONSQUEEZY_API_KEY.",
      );
    }

    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        Authorization: `Bearer ${this.apiKey}`,
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Lemon Squeezy ${action} failed with status ${response.status}.`,
      );
    }

    return (await response.json()) as T;
  }
}
