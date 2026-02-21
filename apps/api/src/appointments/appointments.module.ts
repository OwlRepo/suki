import { Module } from "@nestjs/common";
import { AppointmentsController } from "./appointments.controller";
import { AppointmentsService } from "./appointments.service";
import { AuthModule } from "../auth/auth.module";
import { AutomationModule } from "../automation/automation.module";

@Module({
  imports: [AuthModule, AutomationModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}
