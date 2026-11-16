import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { OwnerGuard } from "../common/owner.guard";
import { Tenant } from "../common/tenant.decorator";
import { BillingService } from "./billing.service";
import { ChangePlanDto, CreateAddonCheckoutDto, CreateCheckoutDto } from "./billing.dto";
import { FeatureFlagsService } from "../common/feature-flags.service";

@Controller("billing")
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  @Get("status")
  @UseGuards(ClerkAuthGuard)
  async getStatus(
    @Tenant("organizationId") orgId?: string,
    @Tenant("role") role?: "owner" | "staff",
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    const status = await this.billingService.getBillingStatus(orgId);
    return {
      ...status,
      readOnly: role === "staff",
    };
  }

  @Get("plans")
  async getPlans() {
    const checkoutEnabled = this.featureFlags.selfServeBillingEnabled();
    const manualRequestEnabled =
      !checkoutEnabled && this.featureFlags.manualBillingControlsEnabled();
    return this.billingService.getPlansResponse({
      checkoutEnabled,
      manualRequestEnabled,
      annualCheckoutEnabled:
        checkoutEnabled && this.featureFlags.annualBillingCheckoutEnabled(),
    });
  }

  @Post("checkout")
  @UseGuards(ClerkAuthGuard, OwnerGuard)
  async createCheckout(
    @Body() body: CreateCheckoutDto,
    @Tenant("organizationId") orgId?: string,
    @Tenant("userId") userId?: string,
  ) {
    if (!orgId || !userId) throw new UnauthorizedException("Unauthorized");
    if (body.billingInterval === "annual" && !this.featureFlags.annualBillingCheckoutEnabled()) {
      throw new BadRequestException({ code: "ANNUAL_BILLING_DISABLED", message: "Annual billing is not available yet." });
    }
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
    @Body() body: CreateAddonCheckoutDto,
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
    @Body() body: ChangePlanDto,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    if (body.billingInterval === "annual" && !this.featureFlags.annualBillingCheckoutEnabled()) {
      throw new BadRequestException({ code: "ANNUAL_BILLING_DISABLED", message: "Annual billing is not available yet." });
    }
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
