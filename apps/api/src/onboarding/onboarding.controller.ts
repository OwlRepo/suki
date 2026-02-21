import { Controller, Get, Patch, Body, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { Tenant } from "../common/tenant.decorator";
import type { TenantContext } from "../common/tenant.decorator";
import { OnboardingService } from "./onboarding.service";

@Controller("onboarding")
@UseGuards(ClerkAuthGuard)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get("progress")
  async getProgress(@Tenant() tenant: TenantContext) {
    return this.onboarding.getProgress(tenant.organizationId, tenant.userId);
  }

  @Patch("progress")
  async updateProgress(
    @Tenant() tenant: TenantContext,
    @Body()
    body: {
      currentStep?: number;
      completedSteps?: string[];
      timeToFirstValueAt?: string | null;
    },
  ) {
    return this.onboarding.updateProgress(
      tenant.organizationId,
      body,
      tenant.userId,
    );
  }
}
