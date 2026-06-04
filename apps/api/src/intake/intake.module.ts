import { Module } from "@nestjs/common";
import { IntakeController } from "./intake.controller";
import { CustomersModule } from "../customers/customers.module";
import { AutomationModule } from "../automation/automation.module";
import { IntakeBookingService } from "./intake-booking.service";
import { PlanCapacityModule } from "../common/plan-capacity.module";
import { OtpFailoverService } from "./otp/otp-failover.service";
import { OtpProviderSettingsService } from "./otp/otp-provider-settings.service";
import { SemaphoreOtpProvider } from "./otp/semaphore-otp.provider";
import { TwilioVerifyOtpProvider } from "./otp/twilio-verify-otp.provider";
import { SEMAPHORE_OTP_PROVIDER, TWILIO_OTP_PROVIDER } from "./otp/otp-provider.tokens";

@Module({
  imports: [CustomersModule, AutomationModule, PlanCapacityModule],
  controllers: [IntakeController],
  providers: [
    IntakeBookingService,
    TwilioVerifyOtpProvider,
    SemaphoreOtpProvider,
    OtpProviderSettingsService,
    OtpFailoverService,
    {
      provide: TWILIO_OTP_PROVIDER,
      useExisting: TwilioVerifyOtpProvider,
    },
    {
      provide: SEMAPHORE_OTP_PROVIDER,
      useExisting: SemaphoreOtpProvider,
    },
  ],
  exports: [IntakeBookingService],
})
export class IntakeModule {}
