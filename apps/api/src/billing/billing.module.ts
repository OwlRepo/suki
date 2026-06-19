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
import { ClientBillingRequestController } from "./client-billing-request.controller";
import { ClientBillingRequestService } from "./client-billing-request.service";

@Module({
  imports: [AuthModule, SecurityModule, PlanCapacityModule],
  controllers: [
    BillingController,
    BillingWebhookController,
    ClientBillingRequestController,
  ],
  providers: [
    BillingService,
    LemonsqueezyService,
    SmsAddonGrantService,
    VerifiedBookingAddonGrantService,
    ClientBillingRequestService,
  ],
  exports: [
    BillingService,
    SmsAddonGrantService,
    VerifiedBookingAddonGrantService,
    ClientBillingRequestService,
  ],
})
export class BillingModule {}
