import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { MessagingService } from "./messaging.service";
import { SmsMeteringService } from "./sms-metering.service";
import { EmailMeteringService } from "./email-metering.service";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { PlanAiMessagingGuard } from "./plan-module.guard";
import { Tenant } from "../common/tenant.decorator";
import { PlanCapacityService } from "../common/plan-capacity.service";

@Controller("messaging")
@UseGuards(ClerkAuthGuard)
export class MessagingController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly planCapacity: PlanCapacityService,
    private readonly smsMetering: SmsMeteringService,
    private readonly emailMetering: EmailMeteringService,
  ) {}

  @Get("credits")
  @UseGuards(PlanAiMessagingGuard)
  async getCredits(@Tenant("organizationId") orgId?: string) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    const credits = await this.messagingService.getCredits(orgId);
    return credits;
  }

  @Get("sms-usage")
  async getSmsUsage(@Tenant("organizationId") orgId?: string) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    return this.smsMetering.getOrCreateCredits(orgId);
  }

  @Get("email-usage")
  async getEmailUsage(@Tenant("organizationId") orgId?: string) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    return this.emailMetering.getOrCreateCredits(orgId);
  }

  @Post("generate")
  @UseGuards(PlanAiMessagingGuard)
  async generate(
    @Body()
    body: {
      businessId: string;
      prompt: string;
      context?: Record<string, unknown>;
    },
    @Tenant("organizationId") orgId?: string,
    @Tenant("userId") userId?: string,
  ) {
    if (!orgId) throw new UnauthorizedException("Unauthorized");
    if (!userId) throw new UnauthorizedException("Unauthorized");
    if (!body.businessId || !body.prompt?.trim()) {
      throw new BadRequestException("businessId and prompt required");
    }
    const result = await this.messagingService.generate(
      orgId,
      userId,
      body.businessId,
      body.prompt.trim(),
      body.context,
    );
    return result;
  }
}
