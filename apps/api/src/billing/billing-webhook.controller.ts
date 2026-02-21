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
import { AuditLogService } from "../security/audit-log.service";
import type { PlanType } from "@suki/types";

@Controller("billing")
export class BillingWebhookController {
  private readonly logger = new Logger(BillingWebhookController.name);

  constructor(
    private readonly billingService: BillingService,
    private readonly paymongoService: PaymongoService,
    private readonly auditLog: AuditLogService,
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

    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction && !this.paymongoService.hasWebhookSecret()) {
      this.logger.warn("PayMongo webhook secret required in production");
      throw new BadRequestException("Webhook not configured");
    }
    if (this.paymongoService.hasWebhookSecret()) {
      if (!signature) {
        this.logger.warn("PayMongo webhook received without signature");
        throw new BadRequestException("Missing signature");
      }
      const isValid = this.paymongoService.verifyWebhookSignature(payload, signature);
      if (!isValid) {
        this.logger.warn("PayMongo webhook signature verification failed");
        throw new BadRequestException("Invalid signature");
      }
    }

    let data: Record<string, unknown>;
    try {
      data = typeof rawBody === "object" ? rawBody : JSON.parse(payload);
    } catch {
      throw new BadRequestException("Invalid JSON");
    }

    const dataObj = data["data"] as Record<string, unknown> | undefined;
    const eventId = String(data["id"] ?? dataObj?.["id"] ?? "").trim() || undefined;
    const attrs = (dataObj?.["attributes"] ?? data["attributes"] ?? data) as Record<string, unknown>;
    const eventType = (attrs?.type ?? data.type) as string | undefined;

    if (eventId) {
      const alreadyProcessed = await this.billingService.isWebhookEventProcessed(eventId);
      if (alreadyProcessed) {
        this.logger.log(`Webhook event ${eventId} already processed, skipping`);
        return { received: true };
      }
    }

    if (
      eventType === "checkout_session.payment.paid" ||
      eventType === "payment.paid"
    ) {
      const inner = attrs?.data as Record<string, unknown> | undefined;
      const innerAttrs = (inner?.attributes ?? attrs) as Record<string, unknown> | undefined;
      const metadata = innerAttrs?.metadata as Record<string, string> | undefined;
      const orgId = metadata?.organization_id;
      const planType = metadata?.plan_type as PlanType | undefined;
      const addonType = metadata?.addon_type as string | undefined;

      if (orgId && addonType === "sms_pack") {
        await this.billingService.creditSmsAddonFromPayment(orgId);
        await this.auditLog.log({
          organizationId: orgId,
          action: "billing_addon_purchase",
          entity: "organization",
          entityId: orgId,
          details: { addon_type: "sms_pack" },
        });
        this.logger.log(`SMS addon credited for org ${orgId}`);
      } else if (orgId && planType && ["growth", "ai_pro"].includes(planType)) {
        await this.billingService.createOrUpdateSubscriptionFromCheckout(
          orgId,
          planType,
          undefined,
          eventId,
        );
        await this.auditLog.log({
          organizationId: orgId,
          action: "billing_plan_change",
          entity: "subscription",
          details: { planType },
        });
        this.logger.log(`Subscription updated for org ${orgId} to ${planType}`);
      }
    } else if (
      eventType === "payment.failed" ||
      eventType === "subscription.invoice.payment_failed" ||
      eventType === "subscription.past_due" ||
      eventType === "subscription.unpaid"
    ) {
      const metadata = attrs?.metadata as Record<string, string> | undefined;
      const orgId = metadata?.organization_id;
      if (orgId) {
        await this.billingService.markSubscriptionPastDue(orgId, eventId);
        this.logger.log(`Subscription marked past_due for org ${orgId}`);
      }
    } else if (eventType === "subscription.cancelled" || eventType === "subscription.canceled") {
      const metadata = attrs?.metadata as Record<string, string> | undefined;
      const orgId = metadata?.organization_id;
      if (orgId) {
        await this.billingService.cancelSubscription(orgId, eventId);
        this.logger.log(`Subscription cancelled for org ${orgId}`);
      }
    }

    if (eventId) {
      await this.billingService.recordWebhookEventId(eventId);
    }

    return { received: true };
  }
}
