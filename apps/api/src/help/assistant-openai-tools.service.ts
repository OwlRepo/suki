import { Injectable } from "@nestjs/common";
import type OpenAI from "openai";
import { AnswerSourceService } from "./answer-source.service";
import { AssistantReadModelService } from "./assistant-read-model.service";
import {
  getAssistantToolPolicy,
  type AssistantPolicyToolName,
} from "./assistant-tool-policy";

export type AssistantNativeReadToolName =
  | "get_business_summary"
  | "get_sms_usage"
  | "get_billing_status"
  | "get_ai_usage"
  | "route_guidance"
  | "get_onboarding_status"
  | "get_subscription_and_limits"
  | "get_owner_daily_briefing"
  | "get_appointments_summary"
  | "get_needs_review_summary"
  | "get_manual_followup_summary"
  | "get_automation_health_summary"
  | "get_customer_audience_count"
  | "get_duplicate_customer_summary"
  | "get_business_performance_comparison"
  | "get_booking_availability"
  | "get_message_delivery_health"
  | "get_automation_runs"
  | "diagnose_reminder_issue"
  | "diagnose_booking_issue"
  | "explain_message_status"
  | "explain_sms_usage"
  | "get_recommended_next_actions"
  | "find_customers"
  | "get_customer_timeline"
  | "get_appointment_details"
  | "get_billing_requests"
  | "list_appointments"
  | "draft_winback_message"
  | "draft_reminder_message";

type ExecuteAssistantToolInput = {
  organizationId: string;
  businessId?: string;
  name: string;
  argumentsJson: string;
};

type ToolArguments = Record<string, unknown>;

const SAFE_ROUTES = [
  "/dashboard",
  "/customers",
  "/appointments",
  "/insights",
  "/analytics",
  "/settings",
  "/help",
  "/onboarding",
  "/needs-attention",
] as const;

function objectSchema(
  properties: Record<string, unknown> = {},
): { [key: string]: unknown } {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required: Object.keys(properties),
  };
}

function functionTool(
  name: AssistantNativeReadToolName,
  description: string,
  properties: Record<string, unknown> = {},
): OpenAI.Responses.Tool {
  return {
    type: "function",
    name,
    description,
    strict: true,
    parameters: objectSchema(properties),
  };
}

function parseArguments(argumentsJson: string): ToolArguments | null {
  try {
    const parsed = JSON.parse(argumentsJson || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as ToolArguments)
      : null;
  } catch {
    return null;
  }
}

function optionalString(
  args: ToolArguments,
  key: string,
): string | null {
  return typeof args[key] === "string" ? args[key] : null;
}

function optionalInteger(
  args: ToolArguments,
  key: string,
): number | null {
  return typeof args[key] === "number" && Number.isInteger(args[key])
    ? args[key]
    : null;
}

@Injectable()
export class AssistantOpenAiToolsService {
  constructor(
    private readonly answerSource: AnswerSourceService,
    private readonly readModel: AssistantReadModelService,
  ) {}

  getToolDefinitions(): OpenAI.Responses.Tool[] {
    return [
      functionTool(
        "get_business_summary",
        "Read the authenticated business monthly customer and visit summary.",
        {
          year: {
            type: ["integer", "null"],
            minimum: 2000,
            maximum: 2100,
          },
          month: {
            type: ["integer", "null"],
            minimum: 1,
            maximum: 12,
          },
        },
      ),
      functionTool(
        "get_sms_usage",
        "Read SMS credit usage for the authenticated organization.",
      ),
      functionTool(
        "get_billing_status",
        "Read billing status for the authenticated organization.",
      ),
      functionTool(
        "get_ai_usage",
        "Read AI usage for the authenticated organization.",
      ),
      functionTool(
        "route_guidance",
        "Read the fixed safe Tyvera application routes.",
      ),
      functionTool(
        "get_onboarding_status",
        "Read onboarding progress for the authenticated organization.",
      ),
      functionTool(
        "get_subscription_and_limits",
        "Read current subscription status and safe product limits for the authenticated organization.",
      ),
      functionTool(
        "get_owner_daily_briefing",
        "Read a privacy-safe daily operational briefing for the authenticated business.",
        {
          date: {
            type: ["string", "null"],
            pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          },
        },
      ),
      functionTool(
        "get_appointments_summary",
        "Read aggregate appointment counts for the authenticated business.",
        {
          from: { type: ["string", "null"], format: "date-time" },
          to: { type: ["string", "null"], format: "date-time" },
        },
      ),
      functionTool(
        "get_needs_review_summary",
        "Read the count of authenticated-business appointments needing review.",
      ),
      functionTool(
        "get_manual_followup_summary",
        "Read aggregate open manual follow-up counts without recipient or message content.",
      ),
      functionTool(
        "get_automation_health_summary",
        "Read enabled automation settings and safe warnings for the authenticated business.",
      ),
      functionTool(
        "get_customer_audience_count",
        "Count an authenticated-business customer audience without returning customer records.",
        {
          minVisits: {
            type: ["integer", "null"],
            minimum: 0,
            maximum: 50,
          },
          inactiveDays: {
            type: ["integer", "null"],
            minimum: 0,
            maximum: 365,
          },
        },
      ),
      functionTool(
        "get_duplicate_customer_summary",
        "Read aggregate possible duplicate-customer counts without customer PII.",
      ),
      functionTool(
        "get_business_performance_comparison",
        "Compare authenticated-business aggregate performance with the previous month.",
        {
          year: {
            type: ["integer", "null"],
            minimum: 2000,
            maximum: 2100,
          },
          month: {
            type: ["integer", "null"],
            minimum: 1,
            maximum: 12,
          },
        },
      ),
      functionTool(
        "get_booking_availability",
        "Read booking availability for the current month through the next three months.",
        {
          month: {
            type: "string",
            pattern: "^\\d{4}-(0[1-9]|1[0-2])$",
          },
        },
      ),
      functionTool(
        "get_message_delivery_health",
        "Read aggregate message delivery health without message bodies or provider errors.",
        {
          days: { type: "integer", enum: [7, 30, 90] },
        },
      ),
      functionTool(
        "get_automation_runs",
        "Read recent automation scheduler run health with current schema scope limitations.",
        {
          days: { type: "integer", enum: [1, 7, 30] },
        },
      ),
      functionTool(
        "diagnose_reminder_issue",
        "Diagnose likely reminder-delivery issues using settings, scheduler health, and aggregate delivery data.",
        {
          days: { type: "integer", enum: [7, 30, 90] },
        },
      ),
      functionTool(
        "diagnose_booking_issue",
        "Diagnose booking availability issues using current and next-month availability data only.",
      ),
      functionTool(
        "explain_message_status",
        "Explain a safe human-readable meaning for a message status without exposing provider internals.",
        {
          status: { type: "string", minLength: 1, maxLength: 64 },
          deliveryStatus: {
            type: ["string", "null"],
            minLength: 1,
            maxLength: 64,
          },
          channel: {
            type: ["string", "null"],
            minLength: 1,
            maxLength: 32,
          },
          failureReason: {
            type: ["string", "null"],
            minLength: 1,
            maxLength: 120,
          },
        },
      ),
      functionTool(
        "explain_sms_usage",
        "Explain SMS usage and pause state for the authenticated organization.",
      ),
      functionTool(
        "get_recommended_next_actions",
        "Read prioritized next actions for the authenticated business using onboarding, review, automation, and billing signals.",
      ),
      functionTool(
        "find_customers",
        "Find up to five authenticated-business customers with masked mobile numbers and no private profile fields.",
        {
          query: { type: "string", minLength: 1, maxLength: 120 },
        },
      ),
      functionTool(
        "get_customer_timeline",
        "Read a privacy-safe recent customer timeline with masked contact details.",
        {
          customerId: { type: "string", minLength: 1, maxLength: 100 },
        },
      ),
      functionTool(
        "get_appointment_details",
        "Read privacy-safe appointment details without exposing notes or contact details.",
        {
          appointmentId: { type: "string", minLength: 1, maxLength: 100 },
        },
      ),
      functionTool(
        "get_billing_requests",
        "Read recent billing requests for the authenticated organization.",
        {
          limit: {
            type: ["integer", "null"],
            minimum: 1,
            maximum: 10,
          },
        },
      ),
      functionTool(
        "list_appointments",
        "List up to ten authenticated-business appointments without notes or contact details.",
        {
          from: { type: ["string", "null"], format: "date-time" },
          to: { type: ["string", "null"], format: "date-time" },
        },
      ),
      functionTool(
        "draft_winback_message",
        "Create immutable win-back draft text. Never save or send it.",
        {
          audienceDescription: {
            type: ["string", "null"],
            maxLength: 160,
          },
          offer: { type: ["string", "null"], maxLength: 120 },
          tone: {
            type: ["string", "null"],
            enum: ["friendly", "concise", "professional", null],
          },
        },
      ),
      functionTool(
        "draft_reminder_message",
        "Create immutable reminder draft text. Never save or send it.",
        {
          scheduledAt: {
            type: ["string", "null"],
            format: "date-time",
          },
          businessName: {
            type: ["string", "null"],
            maxLength: 120,
          },
          tone: {
            type: ["string", "null"],
            enum: ["friendly", "concise", "professional", null],
          },
        },
      ),
    ];
  }

  async execute(input: ExecuteAssistantToolInput): Promise<{
    tool: AssistantNativeReadToolName | "unsupported";
    status: "ok" | "skipped" | "error";
    output: unknown;
  }> {
    if (!this.isSupportedTool(input.name)) {
      return {
        tool: "unsupported",
        status: "error",
        output: { code: "UNSUPPORTED_ASSISTANT_TOOL" },
      };
    }

    const args = parseArguments(input.argumentsJson);
    if (!args) {
      return {
        tool: input.name,
        status: "error",
        output: { code: "INVALID_ASSISTANT_TOOL_ARGUMENTS" },
      };
    }

    const policy = getAssistantToolPolicy(
      input.name as AssistantPolicyToolName,
    );
    if (policy.requiresBusinessScope && !input.businessId) {
      return {
        tool: input.name,
        status: "skipped",
        output: { reason: "missing_business_scope" },
      };
    }

    try {
      switch (input.name) {
        case "get_business_summary":
          return this.ok(
            input.name,
            await this.answerSource.getBusinessSummary({
              organizationId: input.organizationId,
              businessId: input.businessId!,
              year: optionalInteger(args, "year") ?? undefined,
              month: optionalInteger(args, "month") ?? undefined,
            }),
          );
        case "get_sms_usage":
          return this.ok(
            input.name,
            await this.answerSource.getSmsUsage({
              organizationId: input.organizationId,
            }),
          );
        case "get_billing_status":
          return this.ok(
            input.name,
            await this.answerSource.getBillingStatus({
              organizationId: input.organizationId,
            }),
          );
        case "get_ai_usage":
          return this.ok(
            input.name,
            await this.answerSource.getAiUsageSummary({
              organizationId: input.organizationId,
            }),
          );
        case "route_guidance":
          return this.ok(input.name, { routes: [...SAFE_ROUTES] });
        case "get_onboarding_status":
          return this.ok(
            input.name,
            await this.readModel.getOnboardingStatus({
              organizationId: input.organizationId,
            }),
          );
        case "get_subscription_and_limits":
          return this.ok(
            input.name,
            await this.readModel.getSubscriptionAndLimits({
              organizationId: input.organizationId,
              businessId: input.businessId,
            }),
          );
        case "get_owner_daily_briefing":
          return this.ok(
            input.name,
            await this.readModel.getOwnerDailyBriefing({
              organizationId: input.organizationId,
              businessId: input.businessId!,
              date: optionalString(args, "date"),
            }),
          );
        case "get_appointments_summary":
          return this.ok(
            input.name,
            await this.readModel.getAppointmentsSummary({
              organizationId: input.organizationId,
              businessId: input.businessId!,
              from: optionalString(args, "from"),
              to: optionalString(args, "to"),
            }),
          );
        case "get_needs_review_summary":
          return this.ok(
            input.name,
            await this.readModel.getNeedsReviewSummary({
              organizationId: input.organizationId,
              businessId: input.businessId!,
            }),
          );
        case "get_manual_followup_summary":
          return this.ok(
            input.name,
            await this.readModel.getManualFollowupSummary({
              organizationId: input.organizationId,
            }),
          );
        case "get_automation_health_summary":
          return this.ok(
            input.name,
            await this.readModel.getAutomationHealthSummary({
              organizationId: input.organizationId,
              businessId: input.businessId!,
            }),
          );
        case "get_customer_audience_count":
          return this.ok(
            input.name,
            await this.readModel.getCustomerAudienceCount({
              organizationId: input.organizationId,
              businessId: input.businessId!,
              minVisits: optionalInteger(args, "minVisits"),
              inactiveDays: optionalInteger(args, "inactiveDays"),
            }),
          );
        case "get_duplicate_customer_summary":
          return this.ok(
            input.name,
            await this.readModel.getDuplicateCustomerSummary({
              organizationId: input.organizationId,
              businessId: input.businessId!,
            }),
          );
        case "get_business_performance_comparison":
          return this.ok(
            input.name,
            await this.readModel.getBusinessPerformanceComparison({
              organizationId: input.organizationId,
              businessId: input.businessId!,
              year: optionalInteger(args, "year"),
              month: optionalInteger(args, "month"),
            }),
          );
        case "get_booking_availability":
          return this.ok(
            input.name,
            await this.readModel.getBookingAvailability({
              organizationId: input.organizationId,
              businessId: input.businessId!,
              month: optionalString(args, "month") ?? "",
            }),
          );
        case "get_message_delivery_health":
          return this.ok(
            input.name,
            await this.readModel.getMessageDeliveryHealth({
              organizationId: input.organizationId,
              businessId: input.businessId,
              days: this.deliveryDays(args.days),
            }),
          );
        case "get_automation_runs":
          return this.ok(
            input.name,
            await this.readModel.getAutomationRuns({
              organizationId: input.organizationId,
              businessId: input.businessId,
              days: this.automationRunDays(args.days),
            }),
          );
        case "diagnose_reminder_issue":
          return this.ok(
            input.name,
            await this.readModel.diagnoseReminderIssue({
              organizationId: input.organizationId,
              businessId: input.businessId!,
              days: this.deliveryDays(args.days),
            }),
          );
        case "diagnose_booking_issue":
          return this.ok(
            input.name,
            await this.readModel.diagnoseBookingIssue({
              organizationId: input.organizationId,
              businessId: input.businessId!,
            }),
          );
        case "explain_message_status":
          return this.ok(
            input.name,
            this.readModel.explainMessageStatus({
              status: optionalString(args, "status") ?? "",
              deliveryStatus: optionalString(args, "deliveryStatus"),
              channel: optionalString(args, "channel"),
              failureReason: optionalString(args, "failureReason"),
            }),
          );
        case "explain_sms_usage":
          return this.ok(
            input.name,
            await this.readModel.explainSmsUsage({
              organizationId: input.organizationId,
            }),
          );
        case "get_recommended_next_actions":
          return this.ok(
            input.name,
            await this.readModel.getRecommendedNextActions({
              organizationId: input.organizationId,
              businessId: input.businessId!,
            }),
          );
        case "find_customers":
          return this.ok(
            input.name,
            await this.readModel.findCustomers({
              organizationId: input.organizationId,
              businessId: input.businessId!,
              query: optionalString(args, "query") ?? "",
            }),
          );
        case "get_customer_timeline":
          return this.ok(
            input.name,
            await this.readModel.getCustomerTimeline({
              organizationId: input.organizationId,
              businessId: input.businessId!,
              customerId: optionalString(args, "customerId") ?? "",
            }),
          );
        case "get_appointment_details":
          return this.ok(
            input.name,
            await this.readModel.getAppointmentDetails({
              organizationId: input.organizationId,
              businessId: input.businessId!,
              appointmentId: optionalString(args, "appointmentId") ?? "",
            }),
          );
        case "get_billing_requests":
          return this.ok(
            input.name,
            await this.readModel.getBillingRequests({
              organizationId: input.organizationId,
              limit: optionalInteger(args, "limit"),
            }),
          );
        case "list_appointments":
          return this.ok(
            input.name,
            await this.readModel.listAppointments({
              organizationId: input.organizationId,
              businessId: input.businessId!,
              from: optionalString(args, "from"),
              to: optionalString(args, "to"),
            }),
          );
        case "draft_winback_message":
          return this.ok(
            input.name,
            this.readModel.draftWinbackMessage({
              audienceDescription: optionalString(
                args,
                "audienceDescription",
              ),
              offer: optionalString(args, "offer"),
              tone: optionalString(args, "tone"),
            }),
          );
        case "draft_reminder_message":
          return this.ok(
            input.name,
            this.readModel.draftReminderMessage({
              scheduledAt: optionalString(args, "scheduledAt"),
              businessName: optionalString(args, "businessName"),
              tone: optionalString(args, "tone"),
            }),
          );
      }
    } catch {
      return {
        tool: input.name,
        status: "error",
        output: { code: "ASSISTANT_TOOL_EXECUTION_FAILED" },
      };
    }
  }

  private ok(tool: AssistantNativeReadToolName, output: unknown) {
    return {
      tool,
      status: "ok" as const,
      output,
    };
  }

  private deliveryDays(value: unknown): 7 | 30 | 90 {
    return value === 7 || value === 90 ? value : 30;
  }

  private automationRunDays(value: unknown): 1 | 7 | 30 {
    return value === 1 || value === 30 ? value : 7;
  }

  private isSupportedTool(
    name: string,
  ): name is AssistantNativeReadToolName {
    return this.getToolDefinitions().some(
      (tool) => tool.type === "function" && tool.name === name,
    );
  }
}
