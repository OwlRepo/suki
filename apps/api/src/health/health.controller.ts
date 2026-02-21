import { Controller, Get } from "@nestjs/common";
import { getDb } from "@suki/database";
import { sql } from "drizzle-orm";
import { FeatureFlagsService } from "../common/feature-flags.service";

@Controller("health")
export class HealthController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Get()
  health() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }

  @Get("feature-flags")
  getFeatureFlags() {
    return {
      workspace_global_enabled: this.featureFlagsService.workspaceGlobalEnabled(),
      crm_mode_toggle_enabled: this.featureFlagsService.crmModeToggleEnabled(),
      ai_usage_transparency_enabled: this.featureFlagsService.aiUsageTransparencyEnabled(),
      onboarding_v2_enabled: this.featureFlagsService.onboardingV2Enabled(),
    };
  }

  @Get("db")
  async dbHealth() {
    try {
      const db = getDb();
      await (db as { execute: (q: ReturnType<typeof sql>) => Promise<unknown> }).execute(sql`SELECT 1`);
      return { status: "ok", database: "connected" };
    } catch {
      return { status: "error", database: "disconnected" };
    }
  }
}
