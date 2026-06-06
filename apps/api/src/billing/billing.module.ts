import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { BillingWebhookController } from "./billing-webhook.controller";
import { BillingService } from "./billing.service";
import { LemonsqueezyService } from "./lemonsqueezy.service";
import { SmsAddonGrantService } from "./sms-addon-grant.service";
import { VerifiedBookingAddonGrantService } from "./verified-booking-addon-grant.service";
import { AuthModule } from "../auth/auth.module";
import { SecurityModule } from "../security/security.module";
import { PlanCapacityModule } from "../common/plan-capacity.module";

@Module({
  imports: [AuthModule, SecurityModule, PlanCapacityModule],
  controllers: [BillingController, BillingWebhookController],
  providers: [
    BillingService,
    LemonsqueezyService,
    SmsAddonGrantService,
    VerifiedBookingAddonGrantService,
  ],
  exports: [BillingService, SmsAddonGrantService, VerifiedBookingAddonGrantService],
})
export class BillingModule {}
