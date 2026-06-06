import {
  Controller,
  ForbiddenException,
  Get,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { PlatformAdminGuard, type PlatformAdminRequest } from "./platform-admin.guard";
import { RequirePlatformAdminPermissions } from "./platform-admin.decorator";
import { PlatformAdminService } from "./platform-admin.service";

@Controller("platform-admin")
@UseGuards(ClerkAuthGuard, PlatformAdminGuard)
export class PlatformAdminController {
  constructor(private readonly platformAdminService: PlatformAdminService) {}

  @Get("session")
  @RequirePlatformAdminPermissions("PLATFORM_ADMIN_ACCESS")
  getSession(@Req() request: PlatformAdminRequest) {
    if (!request.platformAdmin) {
      throw new ForbiddenException("Platform admin access required");
    }

    return this.platformAdminService.serializeSession(request.platformAdmin);
  }
}
