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
import { Tenant } from "../common/tenant.decorator";
import { AutomationSettingsService } from "./automation-settings.service";

@Controller("automation")
@UseGuards(ClerkAuthGuard)
export class AutomationController {
  constructor(private readonly settings: AutomationSettingsService) {}

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
}
