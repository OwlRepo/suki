import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { BillingWebhookController } from "./billing-webhook.controller";
import { BillingService } from "./billing.service";
import { PaymongoService } from "./paymongo.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [BillingController, BillingWebhookController],
  providers: [BillingService, PaymongoService],
})
export class BillingModule {}
