import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  UnauthorizedException,
} from "@nestjs/common";
import { BillingService } from "./billing.service";
import { OrgBillingStateService } from "../common/org-billing-state.service";
import { FeatureFlagsService } from "../common/feature-flags.service";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { Tenant } from "../common/tenant.decorator";
import { getDb } from "@suki/database";
import { organizations } from "@suki/database";
import { eq } from "drizzle-orm";

@Controller("billing")
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
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
          status: "active_manual",
          planType: "pro",
          readOnly: false,
          billingStatus: "active_manual",
          currentPlan: "pro",
          trialStartsAt: null,
          trialEndsAt: null,
          daysRemaining: null,
          isReadOnly: false,
          nextBillingDueAt: null,
          manualBillingNotes: "All features are currently free.",
          accessEndsAt: null,
          freeMode: true,
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
        status: "active_manual",
        planType: "pro",
        readOnly: false,
        billingStatus: "active_manual",
        currentPlan: "pro",
        trialStartsAt: state.trialStartsAt?.toISOString() ?? null,
        trialEndsAt: state.trialEndsAt?.toISOString() ?? null,
        daysRemaining: null,
        isReadOnly: false,
        nextBillingDueAt: null,
        manualBillingNotes:
          state.manualBillingNotes ?? "All features are currently free.",
        accessEndsAt: org?.accessEndsAt?.toISOString() ?? null,
        freeMode: true,
      };
    }
    const sub = await this.billingService.getSubscription(orgId);
    return {
      subscription: sub,
      status: "active_manual",
      planType: "pro",
      readOnly: false,
      freeMode: true,
    };
  }

  @Get("plans")
  @UseGuards(ClerkAuthGuard)
  async getPlans() {
    return {
      plans: [{ planType: "free", pricePhp: 0 }],
      freeMode: true,
      plansDisabled: true,
      message: "Paid plans are hidden while free mode is active.",
    };
  }

  @Post("checkout")
  @UseGuards(ClerkAuthGuard)
  async createCheckout(
    @Body() _body: { planType: string },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    return {
      freeMode: true,
      checkoutDisabled: true,
      message: "Checkout is disabled. All features are free to use.",
    };
  }

  @Post("sms-addon/purchase")
  @UseGuards(ClerkAuthGuard)
  async purchaseSmsAddon(
    @Body() _body: { confirm?: boolean },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    return {
      freeMode: true,
      purchaseDisabled: true,
      message: "SMS add-on purchase is disabled. Messaging is free to use.",
    };
  }

  @Post("downgrade")
  @UseGuards(ClerkAuthGuard)
  async downgrade(
    @Body() _body: { planType: string },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    const sub = await this.billingService.getSubscription(orgId);
    return {
      subscription: sub,
      planType: "pro",
      freeMode: true,
      message: "Plan changes are disabled. Your workspace has free full access.",
    };
  }

  @Post("dev-switch-plan")
  @UseGuards(ClerkAuthGuard)
  async devSwitchPlan(
    @Body() _body: { planType: string },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    return {
      freeMode: true,
      devSwitchDisabled: true,
      message: "Plan switching is disabled while free mode is active.",
    };
  }
}
