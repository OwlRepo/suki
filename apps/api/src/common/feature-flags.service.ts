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
    // Flags with explicit defaults use them when unset
    const explicitDefault = FLAG_DEFAULTS[flag];
    if (explicitDefault !== undefined) return explicitDefault;
    // Default to enabled outside production to avoid hiding features
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

  autoMessagingEnabled(): boolean {
    return this.isEnabled("auto_messaging_enabled");
  }

  autoFollowupsSchedulerEnabled(): boolean {
    return this.isEnabled("auto_followups_scheduler_enabled");
  }

  billingGraceEnforced(): boolean {
    return this.isEnabled("billing_grace_enforced");
  }

  smsMeteringEnforced(): boolean {
    return this.isEnabled("sms_metering_enforced");
  }

  securityAuditEnabled(): boolean {
    return this.isEnabled("security_audit_enabled");
  }

  founderLedModeEnabled(): boolean {
    return this.isEnabled("founder_led_mode_enabled");
  }

  publicSignupEnabled(): boolean {
    return this.isEnabled("public_signup_enabled");
  }

  selfServeBillingEnabled(): boolean {
    return this.isEnabled("self_serve_billing_enabled");
  }

  annualBillingCheckoutEnabled(): boolean {
    return this.isEnabled("annual_billing_checkout_enabled");
  }

  manualBillingControlsEnabled(): boolean {
    return this.isEnabled("manual_billing_controls_enabled");
  }

  appointmentVisitAutomationEnabled(): boolean {
    return this.isEnabled("appointment_visit_automation_enabled");
  }
}

const FLAG_DEFAULTS: Partial<Record<FeatureFlag, boolean>> = {
  founder_led_mode_enabled: true,
  public_signup_enabled: false,
  self_serve_billing_enabled: false,
  annual_billing_checkout_enabled: false,
  manual_billing_controls_enabled: true,
};

export type FeatureFlag =
  | "workspace_global_enabled"
  | "crm_mode_toggle_enabled"
  | "ai_usage_transparency_enabled"
  | "onboarding_v2_enabled"
  | "auto_messaging_enabled"
  | "auto_followups_scheduler_enabled"
  | "billing_grace_enforced"
  | "sms_metering_enforced"
  | "security_audit_enabled"
  | "founder_led_mode_enabled"
  | "public_signup_enabled"
  | "self_serve_billing_enabled"
  | "annual_billing_checkout_enabled"
  | "manual_billing_controls_enabled"
  | "appointment_visit_automation_enabled";
