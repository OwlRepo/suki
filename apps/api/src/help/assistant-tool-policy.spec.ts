import { describe, expect, it } from "vitest";
import {
  ASSISTANT_TOOL_POLICIES,
  getAssistantToolPolicy,
} from "./assistant-tool-policy";

const EXPECTED_TOOLS = [
  "get_business_summary",
  "get_sms_usage",
  "get_billing_status",
  "get_ai_usage",
  "route_guidance",
  "get_owner_daily_briefing",
  "get_appointments_summary",
  "get_needs_review_summary",
  "get_manual_followup_summary",
  "get_automation_health_summary",
  "get_customer_audience_count",
  "get_duplicate_customer_summary",
  "get_business_performance_comparison",
  "get_booking_availability",
  "get_message_delivery_health",
  "find_customers",
  "list_appointments",
  "draft_winback_message",
  "draft_reminder_message",
  "update_customer",
  "reschedule_appointment",
] as const;

describe("assistant tool policy", () => {
  it("registers policy metadata for every assistant tool", () => {
    expect(Object.keys(ASSISTANT_TOOL_POLICIES).sort()).toEqual(
      [...EXPECTED_TOOLS].sort(),
    );
    for (const tool of EXPECTED_TOOLS) {
      expect(getAssistantToolPolicy(tool)).toEqual(
        expect.objectContaining({
          risk: expect.any(String),
          requiresBusinessScope: expect.any(Boolean),
          maximumRows: expect.any(Number),
          piiMode: expect.stringMatching(/^(none|masked|minimal)$/),
          auditRequired: expect.any(Boolean),
        }),
      );
    }
  });

  it("keeps aggregate reads PII-free and scoped reads bounded", () => {
    const aggregatePolicies = Object.values(ASSISTANT_TOOL_POLICIES).filter(
      (policy) => policy.risk === "aggregate_read",
    );
    expect(aggregatePolicies.length).toBeGreaterThan(0);
    expect(aggregatePolicies.every((policy) => policy.piiMode === "none")).toBe(
      true,
    );

    expect(getAssistantToolPolicy("find_customers")).toMatchObject({
      risk: "scoped_record_read",
      maximumRows: 5,
      piiMode: "masked",
    });
    expect(getAssistantToolPolicy("list_appointments")).toMatchObject({
      risk: "scoped_record_read",
      maximumRows: 10,
      piiMode: "minimal",
    });
  });

  it("marks drafts immutable and mutations confirmed", () => {
    expect(getAssistantToolPolicy("draft_winback_message")).toMatchObject({
      risk: "draft_only",
      auditRequired: false,
    });
    expect(getAssistantToolPolicy("draft_reminder_message")).toMatchObject({
      risk: "draft_only",
      auditRequired: false,
    });
    expect(getAssistantToolPolicy("update_customer")).toMatchObject({
      risk: "confirmed_mutation",
      auditRequired: true,
    });
    expect(getAssistantToolPolicy("reschedule_appointment")).toMatchObject({
      risk: "confirmed_mutation",
      auditRequired: true,
    });
  });
});
