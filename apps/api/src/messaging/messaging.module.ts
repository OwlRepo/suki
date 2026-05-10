import { Module } from "@nestjs/common";
import { MessagingController } from "./messaging.controller";
import { InboundSmsController } from "./inbound-sms.controller";
import { MessagingWebhooksController } from "./messaging-webhooks.controller";
import { MessagingWebhookService } from "./messaging-webhook.service";
import { MessagingService } from "./messaging.service";
import { PlanAiMessagingGuard } from "./plan-module.guard";
import { AuthModule } from "../auth/auth.module";
import { AiModule } from "../ai/ai.module";
import { PlanCapacityModule } from "../common/plan-capacity.module";
import { AutomationPolicyModule } from "../automation/automation-policy.module";
import { SecurityModule } from "../security/security.module";
import { MessageDispatchService } from "./message-dispatch.service";
import { SmsMeteringService } from "./sms-metering.service";
import { EmailMeteringService } from "./email-metering.service";
import { NoopSmsProvider } from "./providers/sms.provider";
import { NoopEmailProvider } from "./providers/email.provider";
import { TwilioSmsProvider } from "./providers/twilio-sms.provider";
import { ResendEmailProvider } from "./providers/resend-email.provider";
import { SMS_PROVIDER, EMAIL_PROVIDER } from "./providers/provider.tokens";
import type { ISmsProvider } from "./providers/sms.provider";
import type { IEmailProvider } from "./providers/email.provider";

function isTwilioConfigured(): boolean {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const serviceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  const phone = process.env.TWILIO_PHONE_NUMBER?.trim();
  const hasSender =
    (serviceSid && !serviceSid.toLowerCase().includes("placeholder")) ||
    (phone && !phone.toLowerCase().includes("placeholder"));
  return !!(sid && token && hasSender && !sid.toLowerCase().includes("placeholder") && !token.toLowerCase().includes("placeholder"));
}

function isResendConfigured(): boolean {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  return !!(key && from && !key.toLowerCase().includes("placeholder") && !from.toLowerCase().includes("placeholder"));
}

@Module({
  imports: [AuthModule, AiModule, PlanCapacityModule, AutomationPolicyModule, SecurityModule],
  controllers: [MessagingController, InboundSmsController, MessagingWebhooksController],
  providers: [
    MessagingService,
    PlanAiMessagingGuard,
    MessageDispatchService,
    SmsMeteringService,
    EmailMeteringService,
    MessagingWebhookService,
    NoopSmsProvider,
    NoopEmailProvider,
    TwilioSmsProvider,
    ResendEmailProvider,
    {
      provide: SMS_PROVIDER,
      useFactory: (twilio: TwilioSmsProvider, noop: NoopSmsProvider): ISmsProvider =>
        isTwilioConfigured() ? twilio : noop,
      inject: [TwilioSmsProvider, NoopSmsProvider],
    },
    {
      provide: EMAIL_PROVIDER,
      useFactory: (resend: ResendEmailProvider, noop: NoopEmailProvider): IEmailProvider =>
        isResendConfigured() ? resend : noop,
      inject: [ResendEmailProvider, NoopEmailProvider],
    },
  ],
  exports: [MessagingService, MessageDispatchService, SmsMeteringService, EmailMeteringService],
})
export class MessagingModule {}
