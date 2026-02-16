import { Module, Global } from "@nestjs/common";
import { PlanCapacityService } from "./plan-capacity.service";

@Global()
@Module({
  providers: [PlanCapacityService],
  exports: [PlanCapacityService],
})
export class PlanCapacityModule {}
