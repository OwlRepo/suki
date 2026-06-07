import { Module } from "@nestjs/common";
import { AutomationJobRunService } from "./automation-job-run.service";
import { OperationsAlertService } from "./operations-alert.service";
import { ProviderHealthService } from "./provider-health.service";

@Module({
  providers: [
    AutomationJobRunService,
    OperationsAlertService,
    ProviderHealthService,
  ],
  exports: [
    AutomationJobRunService,
    OperationsAlertService,
    ProviderHealthService,
  ],
})
export class OperationsModule {}
