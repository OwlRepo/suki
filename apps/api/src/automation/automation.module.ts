import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MessagingModule } from "../messaging/messaging.module";
import { AutomationController } from "./automation.controller";
import { AutomationSettingsService } from "./automation-settings.service";
import { AutomationTriggerService } from "./automation-trigger.service";
import { AutomationSchedulerService } from "./automation-scheduler.service";
import { AutomationMessageComposerService } from "./automation-message-composer.service";
import { AutomationSendService } from "./automation-send.service";

@Module({
  imports: [AuthModule, MessagingModule],
  controllers: [AutomationController],
  providers: [
    AutomationSettingsService,
    AutomationTriggerService,
    AutomationSchedulerService,
    AutomationMessageComposerService,
    AutomationSendService,
  ],
  exports: [
    AutomationSettingsService,
    AutomationTriggerService,
    AutomationSchedulerService,
    AutomationMessageComposerService,
    AutomationSendService,
  ],
})
export class AutomationModule {}
