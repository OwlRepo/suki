import { Injectable } from "@nestjs/common";

/**
 * Rollout feature flags for staged release.
 * Read from env; defaults enabled in development.
 */
@Injectable()
export class FeatureFlagsService {
  isEnabled(flag: FeatureFlag): boolean {
    const key = `FF_${flag}`;
    const val = process.env[key];
    if (val === "false" || val === "0") return false;
    if (val === "true" || val === "1") return true;
    // Default to enabled outside production to avoid hiding features
    // when NODE_ENV is unset in local/dev environments.
    return process.env.NODE_ENV !== "production";
  }

  workspaceGlobalEnabled(): boolean {
    return this.isEnabled("workspace_global_enabled");
  }

  crmModeToggleEnabled(): boolean {
    return this.isEnabled("crm_mode_toggle_enabled");
  }

  aiUsageTransparencyEnabled(): boolean {
    return this.isEnabled("ai_usage_transparency_enabled");
  }

  onboardingV2Enabled(): boolean {
    return this.isEnabled("onboarding_v2_enabled");
  }
}

export type FeatureFlag =
  | "workspace_global_enabled"
  | "crm_mode_toggle_enabled"
  | "ai_usage_transparency_enabled"
  | "onboarding_v2_enabled";
