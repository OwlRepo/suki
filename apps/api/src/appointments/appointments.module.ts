import { Module } from "@nestjs/common";
import { AppointmentsController } from "./appointments.controller";
import { AppointmentsService } from "./appointments.service";
import { AppointmentLifecycleSchedulerService } from "./appointment-lifecycle-scheduler.service";
import { AuthModule } from "../auth/auth.module";
import { AutomationModule } from "../automation/automation.module";
import { IntakeModule } from "../intake/intake.module";

@Module({
  imports: [AuthModule, AutomationModule, IntakeModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AppointmentLifecycleSchedulerService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
