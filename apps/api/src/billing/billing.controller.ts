import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { BillingService } from "./billing.service";
import { PaymongoService } from "./paymongo.service";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { Tenant } from "../common/tenant.decorator";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

@Controller("billing")
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly paymongoService: PaymongoService,
  ) {}

  @Get("status")
  @UseGuards(ClerkAuthGuard)
  async getStatus(@Tenant("organizationId") orgId?: string) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    const sub = await this.billingService.getSubscription(orgId);
    return {
      subscription: sub,
      status: sub?.status ?? "none",
      planType: sub?.planType ?? "starter",
    };
  }

  @Get("plans")
  @UseGuards(ClerkAuthGuard)
  async getPlans() {
    const plans = this.billingService.getPlans();
    return { plans };
  }

  @Post("checkout")
  @UseGuards(ClerkAuthGuard)
  async createCheckout(
    @Body() body: { planType: string },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    const planType = (body.planType ?? "growth") as "starter" | "growth" | "ai_pro";
    if (!["growth", "ai_pro"].includes(planType)) {
      throw new BadRequestException("planType must be growth or ai_pro");
    }
    const plans = this.billingService.getPlans();
    const plan = plans.find((p) => p.planType === planType);
    if (!plan || plan.pricePhp <= 0) {
      throw new BadRequestException("Invalid plan");
    }
    const result = await this.paymongoService.createCheckoutSession({
      organizationId: orgId,
      planType,
      amountPesos: plan.pricePhp,
      successUrl: `${FRONTEND_URL}/settings?checkout=success`,
      cancelUrl: `${FRONTEND_URL}/settings?checkout=cancelled`,
      description: `Suki ${planType} plan`,
    });
    return result;
  }

  @Post("dev-switch-plan")
  @UseGuards(ClerkAuthGuard)
  async devSwitchPlan(
    @Body() body: { planType: string },
    @Tenant("organizationId") orgId?: string,
  ) {
    const isDev =
      process.env.NODE_ENV === "development" ||
      process.env.ENABLE_DEV_TOOLS === "true";
    if (!isDev) {
      throw new ForbiddenException("Dev plan switch is only available in development");
    }
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    const planType = (body.planType ?? "starter") as "starter" | "growth" | "ai_pro";
    if (!["starter", "growth", "ai_pro"].includes(planType)) {
      throw new BadRequestException("planType must be starter, growth, or ai_pro");
    }
    const sub = await this.billingService.createOrUpdateSubscriptionFromCheckout(
      orgId,
      planType,
      undefined,
    );
    return { subscription: sub, planType };
  }
}
