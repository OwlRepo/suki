import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api";

export interface FeatureFlags {
  workspace_global_enabled: boolean;
  crm_mode_toggle_enabled: boolean;
  ai_usage_transparency_enabled: boolean;
  onboarding_v2_enabled: boolean;
  founder_led_mode_enabled: boolean;
  public_signup_enabled: boolean;
  self_serve_billing_enabled: boolean;
  manual_billing_controls_enabled: boolean;
}

const defaults: FeatureFlags = {
  workspace_global_enabled: true,
  crm_mode_toggle_enabled: true,
  ai_usage_transparency_enabled: true,
  onboarding_v2_enabled: true,
  founder_led_mode_enabled: true,
  public_signup_enabled: false,
  self_serve_billing_enabled: false,
  manual_billing_controls_enabled: true,
};

export function useFeatureFlags(): FeatureFlags {
  const [flags, setFlags] = useState<FeatureFlags>(defaults);

  useEffect(() => {
    apiRequest<FeatureFlags>("/health/feature-flags")
      .then(setFlags)
      .catch(() => {});
  }, []);

  return flags;
}
