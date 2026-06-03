import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { BillingWebhookController } from "./billing-webhook.controller";
import { BillingService } from "./billing.service";
import { LemonsqueezyService } from "./lemonsqueezy.service";
import { AuthModule } from "../auth/auth.module";
import { SecurityModule } from "../security/security.module";
import { PlanCapacityModule } from "../common/plan-capacity.module";

@Module({
  imports: [AuthModule, SecurityModule, PlanCapacityModule],
  controllers: [BillingController, BillingWebhookController],
  providers: [BillingService, LemonsqueezyService],
  exports: [BillingService],
})
export class BillingModule {}
