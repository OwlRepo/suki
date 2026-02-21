import { Controller, Get, Patch, Body, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { Tenant } from "../common/tenant.decorator";
import { WorkspaceService } from "./workspace.service";

@Controller("users")
@UseGuards(ClerkAuthGuard)
export class UsersController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get("me/workspace")
  async getWorkspace(
    @Tenant("userId") userId: string,
    @Tenant("organizationId") organizationId: string,
  ) {
    return this.workspaceService.getWorkspace(userId!, organizationId);
  }

  @Patch("me/workspace")
  async setWorkspace(
    @Tenant("userId") userId: string,
    @Tenant("organizationId") organizationId: string,
    @Body() body: { activeBusinessId: string },
  ) {
    if (!body.activeBusinessId?.trim()) {
      return this.workspaceService.getWorkspace(userId!, organizationId);
    }
    return this.workspaceService.setWorkspace(
      userId!,
      organizationId,
      body.activeBusinessId.trim(),
    );
  }
}
