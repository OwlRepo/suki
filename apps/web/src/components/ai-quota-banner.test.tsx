import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiQuotaBanner } from "./ai-quota-banner";

const { apiRequestMock, usePlanCapabilitiesMock, useFeatureFlagsMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
  usePlanCapabilitiesMock: vi.fn(),
  useFeatureFlagsMock: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  apiRequest: apiRequestMock,
}));

vi.mock("@/hooks/use-plan-capabilities", () => ({
  usePlanCapabilities: usePlanCapabilitiesMock,
}));

vi.mock("@/hooks/use-feature-flags", () => ({
  useFeatureFlags: useFeatureFlagsMock,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue("token") }),
}));

describe("AiQuotaBanner", () => {
  afterEach(() => {
    apiRequestMock.mockReset();
    usePlanCapabilitiesMock.mockReset();
    useFeatureFlagsMock.mockReset();
  });

  it("hides AI quota messaging when the plan does not include AI", () => {
    usePlanCapabilitiesMock.mockReturnValue({
      planType: "free",
      canUseAi: false,
      canSeeAssistant: false,
      canSeeAiUsage: false,
      canSeeAiAnalytics: false,
      canSeeRefineWithAi: false,
      loading: false,
      billing: null,
      error: null,
      readOnly: false,
      daysRemaining: null,
    });
    useFeatureFlagsMock.mockReturnValue({ ai_usage_transparency_enabled: true });

    render(<AiQuotaBanner />);

    expect(screen.queryByText(/AI usage at/i)).not.toBeInTheDocument();
    expect(apiRequestMock).not.toHaveBeenCalled();
  });

  it("shows the banner for AI-enabled plans when usage is high", async () => {
    usePlanCapabilitiesMock.mockReturnValue({
      planType: "growth",
      canUseAi: true,
      canSeeAssistant: true,
      canSeeAiUsage: true,
      canSeeAiAnalytics: true,
      canSeeRefineWithAi: true,
      loading: false,
      billing: null,
      error: null,
      readOnly: false,
      daysRemaining: null,
    });
    useFeatureFlagsMock.mockReturnValue({ ai_usage_transparency_enabled: true });
    apiRequestMock.mockResolvedValue({
      plan: "growth",
      tokensUsed: 900,
      tokensLimit: 1000,
      requestsUsed: 10,
      requestsLimit: 100,
      aiEnabled: true,
    });

    render(<AiQuotaBanner />);

    expect(await screen.findByText(/AI usage at 90% of monthly limit/i)).toBeInTheDocument();
  });
});
