import { Module } from "@nestjs/common";
import { MessagingController } from "./messaging.controller";
import { MessagingService } from "./messaging.service";
import { PlanAiMessagingGuard } from "./plan-module.guard";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [MessagingController],
  providers: [MessagingService, PlanAiMessagingGuard],
  exports: [MessagingService],
})
export class MessagingModule {}
