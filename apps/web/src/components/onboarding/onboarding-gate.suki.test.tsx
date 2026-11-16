import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { OnboardingGate } from "./onboarding-gate";

const mock = vi.hoisted(() => ({
  replace: vi.fn(),
  updateProgress: vi.fn(async (_updates: Record<string, unknown>) => undefined),
  markComplete: vi.fn(async () => undefined),
  fetchProgress: vi.fn(),
  workspace: { businesses: [{ id: "biz1", name: "Existing salon", businessType: "salon" }] },
  progress: { currentStep: 3, completedSteps: ["step_1", "step_2"], timeToFirstValueAt: null as string | null },
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/appointments", useRouter: () => ({ replace: mock.replace }) }));
vi.mock("@/hooks/use-onboarding-progress", () => ({
  ONBOARDING_COMPLETE_STEP: 7,
  useOnboardingProgress: () => ({ progress: mock.progress, loading: false, isComplete: mock.progress.currentStep >= 7, markComplete: mock.markComplete, updateProgress: mock.updateProgress, fetchProgress: mock.fetchProgress }),
}));
vi.mock("@/hooks/use-account-freshness", () => ({ useAccountSummary: () => ({ summary: { customers: 0, appointments: 0 } }) }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => mock.workspace }));
vi.mock("@/hooks/use-auth-sync", () => ({ useAuthSync: () => ({ data: { organization: { id: "org1" } }, loading: false }) }));
vi.mock("./onboarding-banner", () => ({ OnboardingBanner: () => <div>Optional setup checklist</div> }));

describe("Suki business-only onboarding gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.workspace.businesses = [{ id: "biz1", name: "Existing salon", businessType: "salon" }];
    mock.progress = { currentStep: 3, completedSteps: ["step_1", "step_2"], timeToFirstValueAt: null };
  });

  it("edge: keeps business setup required when no business exists", async () => {
    mock.workspace.businesses = [];
    render(<OnboardingGate><div>Appointments</div></OnboardingGate>);
    await waitFor(() => expect(mock.replace).toHaveBeenCalledWith("/onboarding"));
    expect(mock.updateProgress).not.toHaveBeenCalled();
  });

  it("regression: unlocks existing businesses without a customer, visit, or appointment exercise", async () => {
    render(<OnboardingGate><div>Appointments</div></OnboardingGate>);
    expect(screen.getByText("Appointments")).toBeInTheDocument();
    await waitFor(() => expect(mock.updateProgress).toHaveBeenCalledWith(expect.objectContaining({ currentStep: 7 })));
    expect(mock.replace).not.toHaveBeenCalled();
    expect(mock.markComplete).not.toHaveBeenCalled();
    const updates = mock.updateProgress.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updates.completedSteps).toEqual(expect.arrayContaining(["step_1", "step_2", "complete"]));
    expect(updates).not.toHaveProperty("timeToFirstValueAt");
  });

  it("regression: does not rewrite completed users or historical first-value timestamps", async () => {
    mock.progress = { currentStep: 7, completedSteps: ["complete"], timeToFirstValueAt: "2026-05-01T10:00:00.000Z" };
    render(<OnboardingGate><div>Appointments</div></OnboardingGate>);
    expect(screen.getByText("Appointments")).toBeInTheDocument();
    expect(mock.updateProgress).not.toHaveBeenCalled();
    expect(mock.markComplete).not.toHaveBeenCalled();
    expect(mock.replace).not.toHaveBeenCalled();
  });
});
