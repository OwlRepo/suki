import { Module, Global } from "@nestjs/common";
import { PlanCapacityService } from "./plan-capacity.service";
import { FeatureFlagsService } from "./feature-flags.service";

@Global()
@Module({
  providers: [PlanCapacityService, FeatureFlagsService],
  exports: [PlanCapacityService, FeatureFlagsService],
})
export class PlanCapacityModule {}
