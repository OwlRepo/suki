import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { InsightsModule } from "../insights/insights.module";
import { MessagingModule } from "../messaging/messaging.module";
import { BillingModule } from "../billing/billing.module";
import { AiModule } from "../ai/ai.module";
import { AppointmentsModule } from "../appointments/appointments.module";
import { CustomersModule } from "../customers/customers.module";
import { AutomationModule } from "../automation/automation.module";
import { OperationsModule } from "../operations/operations.module";
import { SecurityModule } from "../security/security.module";
import { OnboardingService } from "../onboarding/onboarding.service";
import { BusinessesService } from "../businesses/businesses.service";
import { AnswerSourceController } from "./answer-source.controller";
import { AnswerSourceService } from "./answer-source.service";
import { AssistantController } from "./assistant.controller";
import { AssistantMutationService } from "./assistant-mutation.service";
import { AssistantOpenAiToolsService } from "./assistant-openai-tools.service";
import { AssistantReadModelService } from "./assistant-read-model.service";
import { AssistantService } from "./assistant.service";
import { AssistantThreadMemoryService } from "./assistant-thread-memory.service";

@Module({
  imports: [
    AuthModule,
    InsightsModule,
    MessagingModule,
    BillingModule,
    AiModule,
    AppointmentsModule,
    CustomersModule,
    AutomationModule,
    OperationsModule,
    SecurityModule,
  ],
  controllers: [AnswerSourceController, AssistantController],
  providers: [
    OnboardingService,
    BusinessesService,
    AnswerSourceService,
    AssistantService,
    AssistantThreadMemoryService,
    AssistantMutationService,
    AssistantOpenAiToolsService,
    AssistantReadModelService,
  ],
})
export class HelpModule {}
