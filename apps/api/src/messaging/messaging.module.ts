import { Module } from "@nestjs/common";
import { MessagingController } from "./messaging.controller";
import { InboundSmsController } from "./inbound-sms.controller";
import { MessagingService } from "./messaging.service";
import { PlanAiMessagingGuard } from "./plan-module.guard";
import { AuthModule } from "../auth/auth.module";
import { AiModule } from "../ai/ai.module";
import { PlanCapacityModule } from "../common/plan-capacity.module";
import { AutomationPolicyModule } from "../automation/automation-policy.module";
import { SecurityModule } from "../security/security.module";
import { MessageDispatchService } from "./message-dispatch.service";
import { SmsMeteringService } from "./sms-metering.service";
import { NoopSmsProvider } from "./providers/sms.provider";
import { NoopEmailProvider } from "./providers/email.provider";

@Module({
  imports: [AuthModule, AiModule, PlanCapacityModule, AutomationPolicyModule, SecurityModule],
  controllers: [MessagingController, InboundSmsController],
  providers: [
    MessagingService,
    PlanAiMessagingGuard,
    MessageDispatchService,
    SmsMeteringService,
    NoopSmsProvider,
    NoopEmailProvider,
  ],
  exports: [MessagingService, MessageDispatchService, SmsMeteringService],
})
export class MessagingModule {}
