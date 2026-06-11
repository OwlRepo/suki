import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantOpenAiToolsService } from "./assistant-openai-tools.service";

const answerSource = {
  getBusinessSummary: vi.fn(),
  getSmsUsage: vi.fn(),
  getBillingStatus: vi.fn(),
  getAiUsageSummary: vi.fn(),
};

describe("AssistantOpenAiToolsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    answerSource.getBusinessSummary.mockResolvedValue({ domain: "business_summary" });
    answerSource.getSmsUsage.mockResolvedValue({ domain: "sms_usage" });
    answerSource.getBillingStatus.mockResolvedValue({ domain: "billing_status" });
    answerSource.getAiUsageSummary.mockResolvedValue({ domain: "ai_usage" });
  });

  it("exposes only the five approved read-only tools by default", () => {
    const service = new AssistantOpenAiToolsService(answerSource as never);

    const tools = service.getToolDefinitions();

    expect(tools.map((tool) => ("name" in tool ? tool.name : null))).toEqual([
      "get_business_summary",
      "get_sms_usage",
      "get_billing_status",
      "get_ai_usage",
      "route_guidance",
    ]);
    for (const tool of tools) {
      expect(tool.type).toBe("function");
      if (tool.type === "function") {
        expect(tool.strict).toBe(true);
        expect(tool.parameters).toEqual(
          expect.objectContaining({ additionalProperties: false }),
        );
      }
    }
  });

  it("uses a strict-compatible nullable schema for optional summary dates", () => {
    const service = new AssistantOpenAiToolsService(answerSource as never);

    const summaryTool = service.getToolDefinitions()[0];

    expect(summaryTool).toEqual(
      expect.objectContaining({
        type: "function",
        name: "get_business_summary",
        strict: true,
        parameters: expect.objectContaining({
          properties: {
            year: expect.objectContaining({ type: ["integer", "null"] }),
            month: expect.objectContaining({ type: ["integer", "null"] }),
          },
          required: ["year", "month"],
          additionalProperties: false,
        }),
      }),
    );
  });

  it("rejects unsupported tool names without executing a source", async () => {
    const service = new AssistantOpenAiToolsService(answerSource as never);

    const result = await service.execute({
      organizationId: "org-1",
      businessId: "biz-1",
      name: "delete_customer",
      argumentsJson: "{}",
    });

    expect(result).toEqual({
      tool: "unsupported",
      status: "error",
      output: { code: "UNSUPPORTED_ASSISTANT_TOOL" },
    });
    expect(answerSource.getBusinessSummary).not.toHaveBeenCalled();
  });

  it("ignores model attempts to inject another organization ID", async () => {
    const service = new AssistantOpenAiToolsService(answerSource as never);

    await service.execute({
      organizationId: "org-authenticated",
      name: "get_sms_usage",
      argumentsJson: '{"organizationId":"org-attacker"}',
    });

    expect(answerSource.getSmsUsage).toHaveBeenCalledWith({
      organizationId: "org-authenticated",
    });
  });

  it("returns missing_business_scope without executing summary source", async () => {
    const service = new AssistantOpenAiToolsService(answerSource as never);

    const result = await service.execute({
      organizationId: "org-1",
      name: "get_business_summary",
      argumentsJson: "{}",
    });

    expect(result).toEqual({
      tool: "get_business_summary",
      status: "skipped",
      output: { reason: "missing_business_scope" },
    });
    expect(answerSource.getBusinessSummary).not.toHaveBeenCalled();
  });

  it("returns only fixed allowlisted route guidance", async () => {
    const service = new AssistantOpenAiToolsService(answerSource as never);

    const result = await service.execute({
      organizationId: "org-1",
      name: "route_guidance",
      argumentsJson: '{"route":"https://attacker.example"}',
    });

    expect(result.status).toBe("ok");
    expect(result.output).toEqual({
      routes: [
        "/dashboard",
        "/customers",
        "/appointments",
        "/insights",
        "/analytics",
        "/settings",
        "/help",
        "/onboarding",
      ],
    });
  });

  it("calls answer sources with authenticated tenant and business scope", async () => {
    const service = new AssistantOpenAiToolsService(answerSource as never);

    await service.execute({
      organizationId: "org-authenticated",
      businessId: "biz-authenticated",
      name: "get_business_summary",
      argumentsJson: '{"year":2026,"month":6,"businessId":"biz-attacker"}',
    });

    expect(answerSource.getBusinessSummary).toHaveBeenCalledWith({
      organizationId: "org-authenticated",
      businessId: "biz-authenticated",
      year: 2026,
      month: 6,
    });
  });
});
