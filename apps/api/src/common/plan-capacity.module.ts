import { Module, Global } from "@nestjs/common";
import { PlanCapacityService } from "./plan-capacity.service";
import { FeatureFlagsService } from "./feature-flags.service";
import { OrgBillingStateService } from "./org-billing-state.service";
import { BillingWriteGuard } from "./billing-write.guard";

@Global()
@Module({
  providers: [
    PlanCapacityService,
    FeatureFlagsService,
    OrgBillingStateService,
    BillingWriteGuard,
  ],
  exports: [
    PlanCapacityService,
    FeatureFlagsService,
    OrgBillingStateService,
    BillingWriteGuard,
  ],
})
export class PlanCapacityModule {}
