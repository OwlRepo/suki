export type AssistantToolRisk =
  | "aggregate_read"
  | "scoped_record_read"
  | "draft_only"
  | "confirmed_mutation";

export type AssistantToolPolicy = {
  risk: AssistantToolRisk;
  requiresBusinessScope: boolean;
  maximumRows: number;
  piiMode: "none" | "masked" | "minimal";
  auditRequired: boolean;
};

const aggregate = (
  requiresBusinessScope: boolean,
): AssistantToolPolicy => ({
  risk: "aggregate_read",
  requiresBusinessScope,
  maximumRows: 0,
  piiMode: "none",
  auditRequired: false,
});

export const ASSISTANT_TOOL_POLICIES = {
  get_business_summary: aggregate(true),
  get_sms_usage: aggregate(false),
  get_billing_status: aggregate(false),
  get_ai_usage: aggregate(false),
  route_guidance: aggregate(false),
  get_owner_daily_briefing: aggregate(true),
  get_appointments_summary: aggregate(true),
  get_needs_review_summary: aggregate(true),
  get_manual_followup_summary: aggregate(false),
  get_automation_health_summary: aggregate(true),
  get_customer_audience_count: aggregate(true),
  get_duplicate_customer_summary: aggregate(true),
  get_business_performance_comparison: aggregate(true),
  get_booking_availability: aggregate(true),
  get_message_delivery_health: aggregate(false),
  find_customers: {
    risk: "scoped_record_read",
    requiresBusinessScope: true,
    maximumRows: 5,
    piiMode: "masked",
    auditRequired: false,
  },
  list_appointments: {
    risk: "scoped_record_read",
    requiresBusinessScope: true,
    maximumRows: 10,
    piiMode: "minimal",
    auditRequired: false,
  },
  draft_winback_message: {
    risk: "draft_only",
    requiresBusinessScope: false,
    maximumRows: 0,
    piiMode: "none",
    auditRequired: false,
  },
  draft_reminder_message: {
    risk: "draft_only",
    requiresBusinessScope: false,
    maximumRows: 0,
    piiMode: "none",
    auditRequired: false,
  },
  update_customer: {
    risk: "confirmed_mutation",
    requiresBusinessScope: true,
    maximumRows: 1,
    piiMode: "minimal",
    auditRequired: true,
  },
  reschedule_appointment: {
    risk: "confirmed_mutation",
    requiresBusinessScope: true,
    maximumRows: 1,
    piiMode: "minimal",
    auditRequired: true,
  },
} as const satisfies Record<string, AssistantToolPolicy>;

export type AssistantPolicyToolName = keyof typeof ASSISTANT_TOOL_POLICIES;

export function getAssistantToolPolicy(
  name: AssistantPolicyToolName,
): AssistantToolPolicy {
  return ASSISTANT_TOOL_POLICIES[name];
}
