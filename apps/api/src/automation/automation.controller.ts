import {
  Controller,
  Get,
  Patch,
  Body,
  Query,
  UseGuards,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { BillingWriteGuard } from "../common/billing-write.guard";
import { Tenant } from "../common/tenant.decorator";
import { AutomationSettingsService } from "./automation-settings.service";
import { MessagingService } from "../messaging/messaging.service";
import type { AutomationKey } from "@tyvera/types";

@Controller("automation")
@UseGuards(ClerkAuthGuard, BillingWriteGuard)
export class AutomationController {
  constructor(
    private readonly settings: AutomationSettingsService,
    private readonly messaging: MessagingService,
  ) {}

  @Get("settings")
  async getSettings(
    @Query("businessId") businessId: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!businessId || !orgId) throw new BadRequestException("businessId required");
    return this.settings.getOrCreate(businessId, orgId);
  }

  @Patch("settings")
  async updateSettings(
    @Body()
    body: {
      businessId: string;
      appointmentRemindersEnabled?: boolean;
      appointmentReminder72hEnabled?: boolean;
      missedRecoveryEnabled?: boolean;
      postVisitFollowUpEnabled?: boolean;
      inactivityWinbackEnabled?: boolean;
      loyaltyUnlockEnabled?: boolean;
      inactivityDays?: number;
      autoSendChannel?: "sms" | "email";
      messageTemplates?: Partial<
        Record<
          AutomationKey,
          {
            sms?: string;
            email?: string;
          }
        >
      >;
    },
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!body.businessId || !orgId) throw new UnauthorizedException("Unauthorized");
    return this.settings.update(body.businessId, orgId, {
      appointmentRemindersEnabled: body.appointmentRemindersEnabled,
      appointmentReminder72hEnabled: body.appointmentReminder72hEnabled,
      missedRecoveryEnabled: body.missedRecoveryEnabled,
      postVisitFollowUpEnabled: body.postVisitFollowUpEnabled,
      inactivityWinbackEnabled: body.inactivityWinbackEnabled,
      loyaltyUnlockEnabled: body.loyaltyUnlockEnabled,
      inactivityDays: body.inactivityDays,
      autoSendChannel: body.autoSendChannel,
      messageTemplates: body.messageTemplates,
    });
  }

  @Get("previews")
  async getPreviews(
    @Query("businessId") businessId: string,
    @Tenant("organizationId") orgId?: string,
  ) {
    if (!businessId || !orgId) throw new BadRequestException("businessId required");
    return this.settings.getPreviews(businessId, orgId);
  }

  @Patch("refine-message")
  async refineMessage(
    @Body()
    body: {
      businessId: string;
      automationKey: AutomationKey;
      channel: "sms" | "email";
      draft: string;
    },
    @Tenant("organizationId") orgId?: string,
    @Tenant("userId") userId?: string,
  ) {
    if (!orgId || !userId) throw new UnauthorizedException("Unauthorized");
    if (!body.businessId || !body.draft?.trim()) {
      throw new BadRequestException("businessId and draft required");
    }
    const prompt =
      `Refine this ${body.channel.toUpperCase()} automation message for ${body.automationKey}. ` +
      "Keep placeholders like {customerName}, {dateTime}, {staffName}, {link}, {businessName} unchanged.\n\n" +
      body.draft.trim();
    const result = await this.messaging.generate(
      orgId,
      userId,
      body.businessId,
      prompt,
      {
        channel: body.channel,
        automationKey: body.automationKey,
      },
    );
    return { refinedMessage: result.generatedMessage, creditsUsed: result.creditsUsed };
  }
}
