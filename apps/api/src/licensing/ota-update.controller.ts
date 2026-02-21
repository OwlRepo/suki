import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { OtaUpdateService, type ReleaseChannel } from "./ota-update.service";

@Controller("licensing/ota")
@UseGuards(ClerkAuthGuard)
export class OtaUpdateController {
  constructor(private readonly otaUpdateService: OtaUpdateService) {}

  @Get("releases")
  async getReleases(@Query("channel") channel: string = "stable") {
    const ch = (["stable", "beta", "canary"].includes(channel)
      ? channel
      : "stable") as ReleaseChannel;
    return this.otaUpdateService.getReleases(ch);
  }

  @Get("manifest")
  async getManifest(@Query("channel") channel: string = "stable") {
    const ch = (["stable", "beta", "canary"].includes(channel)
      ? channel
      : "stable") as ReleaseChannel;
    return this.otaUpdateService.getUpdateManifest(ch);
  }
}
