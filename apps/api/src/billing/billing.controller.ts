import { Controller, Get, UseGuards, UnauthorizedException } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { Tenant } from "../common/tenant.decorator";

@Controller("billing")
@UseGuards(ClerkAuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get("status")
  async getStatus(@Tenant("organizationId") orgId?: string) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    const sub = await this.billingService.getSubscription(orgId);
    return {
      subscription: sub,
      status: sub?.status ?? "none",
      planType: sub?.planType ?? "starter",
    };
  }
}
