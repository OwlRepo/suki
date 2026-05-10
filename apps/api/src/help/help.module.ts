import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { InsightsModule } from "../insights/insights.module";
import { MessagingModule } from "../messaging/messaging.module";
import { BillingModule } from "../billing/billing.module";
import { AiModule } from "../ai/ai.module";
import { AnswerSourceController } from "./answer-source.controller";
import { AnswerSourceService } from "./answer-source.service";
import { AssistantController } from "./assistant.controller";
import { AssistantService } from "./assistant.service";
import { AssistantThreadMemoryService } from "./assistant-thread-memory.service";

@Module({
  imports: [AuthModule, InsightsModule, MessagingModule, BillingModule, AiModule],
  controllers: [AnswerSourceController, AssistantController],
  providers: [AnswerSourceService, AssistantService, AssistantThreadMemoryService],
})
export class HelpModule {}
