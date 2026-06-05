import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { FeatureFlagsService } from "../common/feature-flags.service";
import { AppointmentsService } from "./appointments.service";

@Injectable()
export class AppointmentLifecycleSchedulerService {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  @Cron("*/5 * * * *")
  async reconcile() {
    if (!this.featureFlags.appointmentVisitAutomationEnabled()) return;
    await this.appointmentsService.reconcileVisitLifecycle();
  }
}
