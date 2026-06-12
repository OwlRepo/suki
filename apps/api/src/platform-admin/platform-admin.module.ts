import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BillingModule } from "../billing/billing.module";
import { OperationsModule } from "../operations/operations.module";
import { MessagingModule } from "../messaging/messaging.module";
import { PlatformAdminBillingEmailService } from "./platform-admin-billing-email.service";
import { PlatformAdminBillingService } from "./platform-admin-billing.service";
import { PlatformAdminCommunicationsService } from "./platform-admin-communications.service";
import { PlatformAdminController } from "./platform-admin.controller";
import { PlatformAdminGuard } from "./platform-admin.guard";
import { PlatformAdminService } from "./platform-admin.service";

@Module({
  imports: [AuthModule, BillingModule, OperationsModule, MessagingModule],
  controllers: [PlatformAdminController],
  providers: [
    PlatformAdminGuard,
    PlatformAdminService,
    PlatformAdminBillingService,
    PlatformAdminBillingEmailService,
    PlatformAdminCommunicationsService,
  ],
  exports: [PlatformAdminService],
})
export class PlatformAdminModule {}
