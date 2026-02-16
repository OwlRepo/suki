import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createHmac } from "crypto";

const PAYMONGO_API = "https://api.paymongo.com/v1";

export interface CreateCheckoutSessionParams {
  organizationId: string;
  planType: string;
  amountPesos: number;
  successUrl: string;
  cancelUrl: string;
  description: string;
}

export interface CheckoutSessionResult {
  checkoutUrl: string;
  sessionId: string;
}

@Injectable()
export class PaymongoService {
  private readonly secretKey: string | null;
  private readonly webhookSecret: string | null;

  constructor() {
    this.secretKey = process.env.PAYMONGO_SECRET_KEY?.trim() || null;
    if (this.secretKey?.toLowerCase().includes("placeholder")) {
      this.secretKey = null;
    }
    this.webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET?.trim() || null;
  }

  isConfigured(): boolean {
    return this.secretKey !== null && this.secretKey.length > 0;
  }

  hasWebhookSecret(): boolean {
    return this.webhookSecret !== null && this.webhookSecret.length > 0;
  }

  verifyWebhookSignature(payload: string | Buffer, signature: string): boolean {
    if (!this.webhookSecret) return false;
    const expected = createHmac("sha256", this.webhookSecret)
      .update(payload)
      .digest("hex");
    return signature === expected;
  }

  async createCheckoutSession(
    params: CreateCheckoutSessionParams,
  ): Promise<CheckoutSessionResult | null> {
    if (!this.secretKey) {
      throw new ServiceUnavailableException(
        "PayMongo is not configured. Set PAYMONGO_SECRET_KEY.",
      );
    }

    const amountCentavos = Math.round(params.amountPesos * 100);
    const body = {
      data: {
        attributes: {
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          description: params.description,
          line_items: [
            {
              amount: amountCentavos,
              currency: "PHP",
              name: `${params.planType} plan`,
              quantity: 1,
              description: `Suki ${params.planType} subscription`,
            },
          ],
          payment_method_types: ["card", "gcash"],
          success_url: params.successUrl,
          cancel_url: params.cancelUrl,
          metadata: {
            organization_id: params.organizationId,
            plan_type: params.planType,
          },
        },
      },
    };

    const auth = Buffer.from(`${this.secretKey}:`).toString("base64");
    const res = await fetch(`${PAYMONGO_API}/checkout_sessions`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new ServiceUnavailableException(
        `PayMongo error: ${res.status} ${errText}`,
      );
    }

    const data = (await res.json()) as {
      data?: {
        id?: string;
        attributes?: { checkout_url?: string };
      };
    };
    const sessionId = data.data?.id ?? "";
    const checkoutUrl = data.data?.attributes?.checkout_url ?? "";

    if (!checkoutUrl) {
      throw new ServiceUnavailableException("PayMongo did not return checkout URL");
    }

    return { checkoutUrl, sessionId };
  }
}
