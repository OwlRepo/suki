import {
  Body,
  Controller,
  Get,
  Post,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { BillingInterval, PlanType } from "@tyvera/types";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { OwnerGuard } from "../common/owner.guard";
import { Tenant } from "../common/tenant.decorator";
import { BillingService } from "./billing.service";
import { FeatureFlagsService } from "../common/feature-flags.service";

@Controller("billing")
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  @Get("status")
  @UseGuards(ClerkAuthGuard)
  async getStatus(@Tenant("organizationId") orgId?: string) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    return this.billingService.getBillingStatus(orgId);
  }

  @Get("plans")
  async getPlans() {
    return this.billingService.getPlansResponse({
      checkoutEnabled: this.featureFlags.selfServeBillingEnabled(),
    });
  }

  @Post("checkout")
  @UseGuards(ClerkAuthGuard, OwnerGuard)
  async createCheckout(
    @Body()
    body: {
      planType: Exclude<PlanType, "free">;
      billingInterval: BillingInterval;
    },
    @Tenant("organizationId") orgId?: string,
    @Tenant("userId") userId?: string,
  ) {
    if (!orgId || !userId) throw new UnauthorizedException("Unauthorized");
    return this.billingService.createSubscriptionCheckout({
      organizationId: orgId,
      userId,
      planType: body.planType,
      billingInterval: body.billingInterval,
    });
  }

  @Post("addons/checkout")
  @UseGuards(ClerkAuthGuard, OwnerGuard)
  async createAddonCheckout(
    @Body()
    body: {
      sku:
        | "online-booking-topup-10"
        | "online-booking-topup-25"
        | "online-booking-topup-50"
        | "online-booking-topup-100"
        | "online-booking-topup-250"
        | "sms-segment-topup-25"
        | "sms-segment-topup-50"
        | "sms-segment-topup-100"
        | "sms-segment-topup-250";
    },
    @Tenant("organizationId") orgId?: string,
    @Tenant("userId") userId?: string,
  ) {
    if (!orgId || !userId) throw new UnauthorizedException("Unauthorized");
    return this.billingService.createAddonCheckout({
      organizationId: orgId,
      userId,
      sku: body.sku,
    });
  }

  @Post("customer-portal")
  @UseGuards(ClerkAuthGuard, OwnerGuard)
  async createCustomerPortal(
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    return this.billingService.createCustomerPortal(orgId);
  }

  @Post("change-plan")
  @UseGuards(ClerkAuthGuard, OwnerGuard)
  async changePlan(
    @Body()
    body: {
      planType: PlanType;
      billingInterval?: BillingInterval;
    },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    return this.billingService.changePlan(orgId, body);
  }

  @Post("cancel")
  @UseGuards(ClerkAuthGuard, OwnerGuard)
  async cancel(@Tenant("organizationId") orgId?: string) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    return this.billingService.cancel(orgId);
  }

  @Post("resume")
  @UseGuards(ClerkAuthGuard, OwnerGuard)
  async resume(@Tenant("organizationId") orgId?: string) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    return this.billingService.resume(orgId);
  }
}
