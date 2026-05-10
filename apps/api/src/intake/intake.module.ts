import { Module } from "@nestjs/common";
import { IntakeController } from "./intake.controller";
import { CustomersModule } from "../customers/customers.module";
import { IntakeBookingService } from "./intake-booking.service";

@Module({
  imports: [CustomersModule],
  controllers: [IntakeController],
  providers: [IntakeBookingService],
  exports: [IntakeBookingService],
})
export class IntakeModule {}
