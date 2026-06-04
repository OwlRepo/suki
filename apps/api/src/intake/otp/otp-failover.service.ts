import { Inject, Injectable } from "@nestjs/common";
import type { IOtpProvider, SendOtpInput, SendOtpResult } from "./otp-provider";
import { SEMAPHORE_OTP_PROVIDER, TWILIO_OTP_PROVIDER } from "./otp-provider.tokens";
import { OtpProviderSettingsService } from "./otp-provider-settings.service";

type OtpMode = "auto" | "twilio" | "semaphore";

@Injectable()
export class OtpFailoverService {
  constructor(
    @Inject(TWILIO_OTP_PROVIDER) private readonly twilio: IOtpProvider,
    @Inject(SEMAPHORE_OTP_PROVIDER) private readonly semaphore: IOtpProvider,
    private readonly settings: OtpProviderSettingsService,
  ) {}

  async sendOtp(input: SendOtpInput & { organizationId: string }): Promise<SendOtpResult> {
    const mode = this.getMode();

    if (mode === "semaphore") {
      return this.semaphore.send(input);
    }
    if (mode === "twilio") {
      return this.twilio.send(input);
    }

    const persisted = await this.settings.getProvider(input.organizationId);
    if (persisted === "semaphore") {
      return this.semaphore.send(input);
    }

    const twilioResult = await this.twilio.send(input);
    if (twilioResult.ok || !twilioResult.failoverEligible) {
      return twilioResult;
    }

    const reason = twilioResult.errorCode ?? "twilio_permanent_failure";
    await this.settings.switchToSemaphore({
      organizationId: input.organizationId,
      reason,
    });
    return this.semaphore.send(input);
  }

  private getMode(): OtpMode {
    const mode = process.env.OTP_PROVIDER_MODE?.trim().toLowerCase();
    return mode === "twilio" || mode === "semaphore" ? mode : "auto";
  }
}
