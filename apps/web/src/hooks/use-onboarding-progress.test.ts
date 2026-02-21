import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useOnboardingProgress, ONBOARDING_COMPLETE_STEP } from "./use-onboarding-progress";

const mockGetToken = vi.fn();

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ getToken: mockGetToken }),
}));

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}));

describe("useOnboardingProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue("fake-token");
  });

  it("fetches progress and exposes isComplete when currentStep >= 9", async () => {
    const { apiRequest } = await import("@/lib/api");
    (apiRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      currentStep: ONBOARDING_COMPLETE_STEP,
      completedSteps: ["complete"],
      timeToFirstValueAt: new Date().toISOString(),
    });

    const { result } = renderHook(() => useOnboardingProgress());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isComplete).toBe(true);
    expect(result.current.currentStep).toBe(ONBOARDING_COMPLETE_STEP);
  });

  it("exposes isComplete false when currentStep < 9", async () => {
    const { apiRequest } = await import("@/lib/api");
    (apiRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      currentStep: 3,
      completedSteps: ["step_1", "step_2"],
      timeToFirstValueAt: null,
    });

    const { result } = renderHook(() => useOnboardingProgress());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isComplete).toBe(false);
    expect(result.current.currentStep).toBe(3);
  });

  it("advanceStep updates progress via PATCH", async () => {
    const { apiRequest } = await import("@/lib/api");
    (apiRequest as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        currentStep: 2,
        completedSteps: ["step_1", "step_2"],
        timeToFirstValueAt: null,
      })
      .mockResolvedValueOnce({
        currentStep: 3,
        completedSteps: ["step_1", "step_2", "step_3"],
        timeToFirstValueAt: null,
      });

    const { result } = renderHook(() => useOnboardingProgress());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.advanceStep();
    });

    expect(apiRequest).toHaveBeenLastCalledWith("/onboarding/progress", {
      method: "PATCH",
      token: "fake-token",
      body: expect.stringContaining('"currentStep":3'),
    });
  });
});
