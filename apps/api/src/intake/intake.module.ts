import { Module } from "@nestjs/common";
import { IntakeController } from "./intake.controller";
import { CustomersModule } from "../customers/customers.module";
import { AutomationModule } from "../automation/automation.module";
import { IntakeBookingService } from "./intake-booking.service";
import { PlanCapacityModule } from "../common/plan-capacity.module";

@Module({
  imports: [CustomersModule, AutomationModule, PlanCapacityModule],
  controllers: [IntakeController],
  providers: [IntakeBookingService],
  exports: [IntakeBookingService],
})
export class IntakeModule {}
