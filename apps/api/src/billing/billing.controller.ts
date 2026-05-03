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
import { PlanCapacityService } from "../common/plan-capacity.service";
import { OrgBillingStateService } from "../common/org-billing-state.service";
import { FeatureFlagsService } from "../common/feature-flags.service";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { Tenant } from "../common/tenant.decorator";
import { getDb } from "@suki/database";
import { organizations } from "@suki/database";
import { eq } from "drizzle-orm";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const SELF_SERVE_DISABLED = "SELF_SERVE_DISABLED";

@Controller("billing")
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly paymongoService: PaymongoService,
    private readonly planCapacity: PlanCapacityService,
    private readonly orgBillingState: OrgBillingStateService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  @Get("status")
  @UseGuards(ClerkAuthGuard)
  async getStatus(@Tenant("organizationId") orgId?: string) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    if (this.featureFlags.founderLedModeEnabled()) {
      const state = await this.orgBillingState.getOrgBillingState(orgId);
      if (!state) {
        return {
          subscription: null,
          status: "none",
          planType: "starter",
          readOnly: false,
          billingStatus: "trial_active",
          currentPlan: "starter",
          trialStartsAt: null,
          trialEndsAt: null,
          daysRemaining: null,
          isReadOnly: false,
          nextBillingDueAt: null,
          manualBillingNotes: null,
          accessEndsAt: null,
        };
      }
      const db = getDb();
      const [org] = await db
        .select({ accessEndsAt: organizations.accessEndsAt })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);
      return {
        subscription: null,
        status: state.billingStatus,
        planType: state.currentPlan,
        readOnly: state.isReadOnly,
        billingStatus: state.billingStatus,
        currentPlan: state.currentPlan,
        trialStartsAt: state.trialStartsAt?.toISOString() ?? null,
        trialEndsAt: state.trialEndsAt?.toISOString() ?? null,
        daysRemaining: state.daysRemaining,
        isReadOnly: state.isReadOnly,
        nextBillingDueAt: state.nextBillingDueAt?.toISOString() ?? null,
        manualBillingNotes: state.manualBillingNotes,
        accessEndsAt: org?.accessEndsAt?.toISOString() ?? null,
      };
    }
    const sub = await this.billingService.getSubscription(orgId);
    const readOnly = await this.planCapacity.isReadOnly(orgId);
    return {
      subscription: sub,
      status: sub?.status ?? "none",
      planType: sub?.planType ?? "starter",
      readOnly,
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
    if (!this.featureFlags.selfServeBillingEnabled()) {
      throw new ForbiddenException(SELF_SERVE_DISABLED);
    }
    const planType = (body.planType ?? "growth") as "starter" | "growth" | "pro";
    if (!["growth", "pro"].includes(planType)) {
      throw new BadRequestException("planType must be growth or pro");
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

  @Post("sms-addon/purchase")
  @UseGuards(ClerkAuthGuard)
  async purchaseSmsAddon(
    @Body() body: { confirm?: boolean },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    if (!this.featureFlags.selfServeBillingEnabled()) {
      throw new ForbiddenException(SELF_SERVE_DISABLED);
    }
    if (body.confirm !== true) {
      throw new BadRequestException(
        "Explicit confirmation required. Set body: { confirm: true }.",
      );
    }
    const result = await this.paymongoService.createCheckoutSession({
      organizationId: orgId,
      amountPesos: 300,
      successUrl: `${FRONTEND_URL}/settings?addon=success`,
      cancelUrl: `${FRONTEND_URL}/settings?addon=cancelled`,
      description: "Suki +300 SMS pack",
      metadata: { addon_type: "sms_pack" },
    });
    return result;
  }

  @Post("downgrade")
  @UseGuards(ClerkAuthGuard)
  async downgrade(
    @Body() body: { planType: string },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    if (!this.featureFlags.selfServeBillingEnabled()) {
      throw new ForbiddenException(SELF_SERVE_DISABLED);
    }
    const planType = (body.planType ?? "starter") as "starter" | "growth" | "pro";
    if (!["starter", "growth", "pro"].includes(planType)) {
      throw new BadRequestException("planType must be starter, growth, or pro");
    }
    const sub = await this.billingService.downgradePlan(orgId, planType);
    return { subscription: sub, planType };
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
    const planType = (body.planType ?? "starter") as "starter" | "growth" | "pro";
    if (!["starter", "growth", "pro"].includes(planType)) {
      throw new BadRequestException("planType must be starter, growth, or pro");
    }
    const sub = await this.billingService.createOrUpdateSubscriptionFromCheckout(
      orgId,
      planType,
      undefined,
    );
    return { subscription: sub, planType };
  }
}
