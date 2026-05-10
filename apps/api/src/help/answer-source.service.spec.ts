import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnswerSourceService } from "./answer-source.service";

const insights = {
  getMonthlyMetrics: vi.fn(),
};
const smsMetering = {
  getOrCreateCredits: vi.fn(),
};
const billing = {
  getSubscription: vi.fn(),
};
const aiUsage = {
  getSummary: vi.fn(),
};

describe("AnswerSourceService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns normalized monthly business summary", async () => {
    insights.getMonthlyMetrics.mockResolvedValue({
      year: 2026,
      month: 5,
      newCustomers: 10,
      repeatCustomers: 4,
      repeatVisits: 22,
    });

    const service = new AnswerSourceService(
      insights as never,
      smsMetering as never,
      billing as never,
      aiUsage as never,
    );

    const result = await service.getBusinessSummary({
      organizationId: "org-1",
      businessId: "biz-1",
      year: 2026,
      month: 5,
    });

    expect(result.domain).toBe("business_summary");
    expect(result.canonical).toEqual({
      year: 2026,
      month: 5,
      newCustomers: 10,
      repeatCustomers: 4,
      repeatVisits: 22,
    });
    expect(result.asOf).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.businessScope).toBe("biz-1");
  });

  it("returns source-only fallback when summary is unavailable", async () => {
    insights.getMonthlyMetrics.mockResolvedValue(null);

    const service = new AnswerSourceService(
      insights as never,
      smsMetering as never,
      billing as never,
      aiUsage as never,
    );

    const result = await service.getBusinessSummary({
      organizationId: "org-1",
      businessId: "biz-missing",
      year: 2026,
      month: 5,
    });

    expect(result.available).toBe(false);
    expect(result.humanReadable).toContain("No source data available");
    expect(result.canonical).toBeNull();
  });

  it("returns sms remaining and usage", async () => {
    smsMetering.getOrCreateCredits.mockResolvedValue({
      included: 300,
      addon: 50,
      used: 100,
      total: 350,
      remaining: 250,
      pausedReason: "none",
      at80Pct: false,
      at100Pct: false,
    });

    const service = new AnswerSourceService(
      insights as never,
      smsMetering as never,
      billing as never,
      aiUsage as never,
    );

    const result = await service.getSmsUsage({ organizationId: "org-1" });
    expect(result.domain).toBe("sms_usage");
    expect(result.canonical).toEqual(expect.objectContaining({ remaining: 250, used: 100 }));
  });
});
