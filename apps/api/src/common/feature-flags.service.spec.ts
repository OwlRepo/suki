import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FeatureFlagsService } from "./feature-flags.service";

describe("FeatureFlagsService", () => {
  let service: FeatureFlagsService;
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    service = new FeatureFlagsService();
    process.env.NODE_ENV = "production";
    delete process.env.FF_workspace_global_enabled;
    delete process.env.FF_crm_mode_toggle_enabled;
    delete process.env.FF_ai_usage_transparency_enabled;
    delete process.env.FF_onboarding_v2_enabled;
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("returns false when flag explicitly disabled", () => {
    process.env.FF_workspace_global_enabled = "false";
    expect(service.workspaceGlobalEnabled()).toBe(false);
    process.env.FF_workspace_global_enabled = "0";
    expect(service.workspaceGlobalEnabled()).toBe(false);
  });

  it("returns true when flag explicitly enabled", () => {
    process.env.FF_workspace_global_enabled = "true";
    expect(service.workspaceGlobalEnabled()).toBe(true);
    process.env.FF_workspace_global_enabled = "1";
    expect(service.workspaceGlobalEnabled()).toBe(true);
  });

  it("returns true in development when flag unset", () => {
    process.env.NODE_ENV = "development";
    expect(service.workspaceGlobalEnabled()).toBe(true);
  });

  it("returns false in production when flag unset", () => {
    process.env.NODE_ENV = "production";
    expect(service.workspaceGlobalEnabled()).toBe(false);
  });

  it("provides all flag getters", () => {
    process.env.FF_crm_mode_toggle_enabled = "true";
    process.env.FF_ai_usage_transparency_enabled = "true";
    process.env.FF_onboarding_v2_enabled = "true";
    expect(service.crmModeToggleEnabled()).toBe(true);
    expect(service.aiUsageTransparencyEnabled()).toBe(true);
    expect(service.onboardingV2Enabled()).toBe(true);
  });
});
