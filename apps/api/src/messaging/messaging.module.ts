import { Module } from "@nestjs/common";
import { MessagingController } from "./messaging.controller";
import { MessagingService } from "./messaging.service";
import { PlanAiMessagingGuard } from "./plan-module.guard";
import { AuthModule } from "../auth/auth.module";
import { AiModule } from "../ai/ai.module";

@Module({
  imports: [AuthModule, AiModule],
  controllers: [MessagingController],
  providers: [MessagingService, PlanAiMessagingGuard],
  exports: [MessagingService],
})
export class MessagingModule {}
