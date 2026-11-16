import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OnboardingWizard } from "./onboarding-wizard";

const mock = vi.hoisted(() => ({
  replace: vi.fn(),
  updateProgress: vi.fn(async (_updates: Record<string, unknown>) => undefined),
  fetchProgress: vi.fn(),
  businesses: [] as Array<{ id: string; name: string; businessType: string }>,
  progress: { currentStep: 1, completedSteps: ["step_1"], timeToFirstValueAt: null },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mock.replace }) }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ businesses: mock.businesses, loading: false }) }));
vi.mock("@/hooks/use-onboarding-progress", () => ({
  ONBOARDING_COMPLETE_STEP: 7,
  useOnboardingProgress: () => ({ progress: mock.progress, loading: false, isComplete: false, currentStep: 1, updateProgress: mock.updateProgress, fetchProgress: mock.fetchProgress }),
}));
vi.mock("./onboarding-setup-step", () => ({
  OnboardingSetupStep: ({ onBusinessCreated }: { onBusinessCreated: () => void }) => <button onClick={onBusinessCreated}>Create business</button>,
}));

describe("Suki business-only setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.businesses = [];
    mock.updateProgress.mockResolvedValue(undefined);
  });

  it("error: exposes a retry when business setup completion cannot be saved", async () => {
    mock.updateProgress.mockRejectedValueOnce(new Error("Could not save setup"));
    render(<OnboardingWizard />);
    fireEvent.click(screen.getByRole("button", { name: "Create business" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save setup");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(mock.replace).toHaveBeenCalledWith("/dashboard?welcome=1"));
  });

  it("regression: creating a business finishes setup without customer, visit, or appointment exercises", async () => {
    render(<OnboardingWizard />);
    fireEvent.click(screen.getByRole("button", { name: "Create business" }));
    await waitFor(() => expect(mock.updateProgress).toHaveBeenCalledWith({ currentStep: 7, completedSteps: ["step_1", "complete"] }));
    expect(mock.replace).toHaveBeenCalledWith("/dashboard?welcome=1");
    expect(screen.queryByPlaceholderText(/Customer name/)).not.toBeInTheDocument();
  });

  it("regression: existing businesses finish legacy setup without rewriting first-value history", async () => {
    mock.businesses = [{ id: "biz1", name: "Salon", businessType: "salon" }];
    render(<OnboardingWizard />);
    await waitFor(() => expect(mock.updateProgress).toHaveBeenCalledWith({ currentStep: 7, completedSteps: ["step_1", "complete"] }));
    expect(mock.updateProgress.mock.calls[0]?.[0]).not.toHaveProperty("timeToFirstValueAt");
  });
});
