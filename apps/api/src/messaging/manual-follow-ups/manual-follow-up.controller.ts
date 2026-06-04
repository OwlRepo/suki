import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ClerkAuthGuard } from "../../auth/clerk-auth.guard";
import { Tenant } from "../../common/tenant.decorator";
import { ManualFollowUpRetryService } from "./manual-follow-up-retry.service";
import { ManualFollowUpService } from "./manual-follow-up.service";
import type { ManualFollowUpStatus } from "./manual-follow-up.types";

@Controller("messaging/manual-follow-ups")
@UseGuards(ClerkAuthGuard)
export class ManualFollowUpController {
  constructor(
    private readonly manualFollowUps: ManualFollowUpService,
    private readonly retryService: ManualFollowUpRetryService,
  ) {}

  @Get()
  async list(
    @Tenant("organizationId") organizationId?: string,
    @Query("status") status?: ManualFollowUpStatus,
  ) {
    if (!organizationId) throw new UnauthorizedException("Unauthorized");
    if (status && !["open", "contacted", "dismissed"].includes(status)) {
      throw new BadRequestException("Invalid status");
    }
    return this.manualFollowUps.list({ organizationId, status });
  }

  @Get("open-count")
  async openCount(@Tenant("organizationId") organizationId?: string) {
    if (!organizationId) throw new UnauthorizedException("Unauthorized");
    return this.manualFollowUps.countOpen(organizationId);
  }

  @Patch(":id")
  async resolve(
    @Param("id") taskId: string,
    @Body() body: { status?: ManualFollowUpStatus },
    @Tenant("organizationId") organizationId?: string,
    @Tenant("userId") userId?: string,
  ) {
    if (!organizationId || !userId) throw new UnauthorizedException("Unauthorized");
    if (body.status !== "contacted" && body.status !== "dismissed") {
      throw new BadRequestException("Invalid status");
    }
    return this.manualFollowUps.resolve({
      organizationId,
      userId,
      taskId,
      status: body.status,
    });
  }

  @Post(":id/retry-sms")
  async retrySms(
    @Param("id") taskId: string,
    @Tenant("organizationId") organizationId?: string,
    @Tenant("userId") userId?: string,
  ) {
    if (!organizationId || !userId) throw new UnauthorizedException("Unauthorized");
    return this.retryService.retryAutomaticSms({ organizationId, userId, taskId });
  }
}
