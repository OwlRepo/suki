import { Injectable } from "@nestjs/common";
import type OpenAI from "openai";
import { AnswerSourceService } from "./answer-source.service";

export type AssistantNativeReadToolName =
  | "get_business_summary"
  | "get_sms_usage"
  | "get_billing_status"
  | "get_ai_usage"
  | "route_guidance";

type ExecuteAssistantToolInput = {
  organizationId: string;
  businessId?: string;
  name: string;
  argumentsJson: string;
};

type ToolArguments = {
  year?: unknown;
  month?: unknown;
};

const SAFE_ROUTES = [
  "/dashboard",
  "/customers",
  "/appointments",
  "/insights",
  "/analytics",
  "/settings",
  "/help",
  "/onboarding",
] as const;

function emptyObjectSchema(): { [key: string]: unknown } {
  return {
    type: "object",
    additionalProperties: false,
    properties: {},
    required: [],
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

@Injectable()
export class AssistantOpenAiToolsService {
  constructor(private readonly answerSource: AnswerSourceService) {}

  getToolDefinitions(): OpenAI.Responses.Tool[] {
    return [
      {
        type: "function",
        name: "get_business_summary",
        description:
          "Read the authenticated business monthly customer and visit summary.",
        strict: true,
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
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
          required: ["year", "month"],
        },
      },
      {
        type: "function",
        name: "get_sms_usage",
        description: "Read SMS credit usage for the authenticated organization.",
        strict: true,
        parameters: emptyObjectSchema(),
      },
      {
        type: "function",
        name: "get_billing_status",
        description: "Read billing status for the authenticated organization.",
        strict: true,
        parameters: emptyObjectSchema(),
      },
      {
        type: "function",
        name: "get_ai_usage",
        description: "Read AI usage for the authenticated organization.",
        strict: true,
        parameters: emptyObjectSchema(),
      },
      {
        type: "function",
        name: "route_guidance",
        description: "Read the fixed safe Tyvera application routes.",
        strict: true,
        parameters: emptyObjectSchema(),
      },
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

    try {
      if (input.name === "get_business_summary") {
        if (!input.businessId) {
          return {
            tool: input.name,
            status: "skipped",
            output: { reason: "missing_business_scope" },
          };
        }
        const year =
          typeof args.year === "number" && Number.isInteger(args.year)
            ? args.year
            : undefined;
        const month =
          typeof args.month === "number" && Number.isInteger(args.month)
            ? args.month
            : undefined;
        return {
          tool: input.name,
          status: "ok",
          output: await this.answerSource.getBusinessSummary({
            organizationId: input.organizationId,
            businessId: input.businessId,
            year,
            month,
          }),
        };
      }

      if (input.name === "get_sms_usage") {
        return {
          tool: input.name,
          status: "ok",
          output: await this.answerSource.getSmsUsage({
            organizationId: input.organizationId,
          }),
        };
      }

      if (input.name === "get_billing_status") {
        return {
          tool: input.name,
          status: "ok",
          output: await this.answerSource.getBillingStatus({
            organizationId: input.organizationId,
          }),
        };
      }

      if (input.name === "get_ai_usage") {
        return {
          tool: input.name,
          status: "ok",
          output: await this.answerSource.getAiUsageSummary({
            organizationId: input.organizationId,
          }),
        };
      }

      return {
        tool: input.name,
        status: "ok",
        output: { routes: [...SAFE_ROUTES] },
      };
    } catch {
      return {
        tool: input.name,
        status: "error",
        output: { code: "ASSISTANT_TOOL_EXECUTION_FAILED" },
      };
    }
  }

  private isSupportedTool(name: string): name is AssistantNativeReadToolName {
    return (
      name === "get_business_summary" ||
      name === "get_sms_usage" ||
      name === "get_billing_status" ||
      name === "get_ai_usage" ||
      name === "route_guidance"
    );
  }
}
