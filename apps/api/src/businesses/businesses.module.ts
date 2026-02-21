import { Module } from "@nestjs/common";
import { BusinessesController } from "./businesses.controller";
import { BusinessesService } from "./businesses.service";
import { AuthModule } from "../auth/auth.module";
import { PlanCapacityModule } from "../common/plan-capacity.module";

@Module({
  imports: [AuthModule, PlanCapacityModule],
  controllers: [BusinessesController],
  providers: [BusinessesService],
})
export class BusinessesModule {}
