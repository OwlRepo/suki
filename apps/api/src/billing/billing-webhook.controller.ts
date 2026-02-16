import {
  Controller,
  Post,
  Req,
  Headers,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { Request } from "express";
import { BillingService } from "./billing.service";
import { PaymongoService } from "./paymongo.service";
import type { PlanType } from "@suki/types";

@Controller("billing")
export class BillingWebhookController {
  private readonly logger = new Logger(BillingWebhookController.name);

  constructor(
    private readonly billingService: BillingService,
    private readonly paymongoService: PaymongoService,
  ) {}

  @Post("webhook/paymongo")
  async handlePaymongoWebhook(
    @Req() req: Request,
    @Headers("paymongo-signature") signature: string,
  ) {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody ?? req.body;
    const payload =
      typeof rawBody === "string"
        ? rawBody
        : Buffer.isBuffer(rawBody)
          ? rawBody.toString("utf8")
          : JSON.stringify(rawBody);

    if (this.paymongoService.hasWebhookSecret() && signature) {
      const isValid = this.paymongoService.verifyWebhookSignature(payload, signature);
      if (!isValid) {
        this.logger.warn("PayMongo webhook signature verification failed");
        throw new BadRequestException("Invalid signature");
      }
    } else if (this.paymongoService.hasWebhookSecret()) {
      this.logger.warn("PayMongo webhook received without signature");
      throw new BadRequestException("Missing signature");
    }

    let data: Record<string, unknown>;
    try {
      data = typeof rawBody === "object" ? rawBody : JSON.parse(payload);
    } catch {
      throw new BadRequestException("Invalid JSON");
    }

    const attrs = data.attributes as Record<string, unknown> | undefined;
    const eventType = (attrs?.type ?? data.type) as string | undefined;
    if (eventType === "checkout_session.payment.paid") {
      const inner = attrs?.data as Record<string, unknown> | undefined;
      const innerAttrs = (inner?.attributes ?? attrs) as Record<string, unknown> | undefined;
      const metadata = innerAttrs?.metadata as Record<string, string> | undefined;
      const orgId = metadata?.organization_id;
      const planType = metadata?.plan_type as PlanType | undefined;

      if (orgId && planType && ["growth", "ai_pro"].includes(planType)) {
        await this.billingService.createOrUpdateSubscriptionFromCheckout(
          orgId,
          planType,
        );
        this.logger.log(`Subscription updated for org ${orgId} to ${planType}`);
      }
    }

    return { received: true };
  }
}
