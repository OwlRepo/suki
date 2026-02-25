import { Controller, Get, Patch, Body, Query, UseGuards } from "@nestjs/common";
import { OrganizationsService } from "./organizations.service";
import { RecommendationService } from "../common/recommendation.service";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { BillingWriteGuard } from "../common/billing-write.guard";
import { Tenant } from "../common/tenant.decorator";

@Controller("organizations")
@UseGuards(ClerkAuthGuard, BillingWriteGuard)
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly recommendationService: RecommendationService,
  ) {}

  @Get("me")
  async getCurrent(@Tenant("organizationId") orgId: string) {
    const org = await this.organizationsService.findById(orgId);
    if (!org) return { organization: null };
    return { organization: org };
  }

  @Patch("me")
  async updateCurrent(
    @Tenant("organizationId") orgId: string,
    @Body() body: { name?: string },
  ) {
    const updated = await this.organizationsService.update(orgId, body);
    return { organization: updated };
  }

  @Get("me/recommendations")
  async getRecommendations(
    @Tenant("organizationId") _orgId: string,
    @Query("businessType") businessType?: string,
  ) {
    const modules = this.recommendationService.getRecommendedModules(
      businessType ?? "other",
    );
    const businessTypes = this.recommendationService.getAllBusinessTypes();
    return { recommendedModules: modules, businessTypes };
  }
}
