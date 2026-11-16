import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdaptiveAppShell } from "./adaptive-app-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ businesses: [], activeBusinessId: "" }) }));
vi.mock("@/hooks/use-plan-capabilities", () => ({ usePlanCapabilities: () => ({ canSeeAiAnalytics: false, canSeeAssistant: false }) }));
vi.mock("@/hooks/use-sidebar-collapsed", () => ({ useSidebarCollapsed: () => ({ collapsed: false, toggle: vi.fn() }) }));
vi.mock("@/components/needs-attention/manual-follow-up.api", () => ({ getOpenManualFollowUpCount: async () => ({ count: 0 }) }));
vi.mock("@/components/auth-button", () => ({ AuthButton: () => <button>Sign out</button> }));
vi.mock("@/components/workspace-dropdown", () => ({ WorkspaceDropdown: () => <button>Workspace</button> }));
vi.mock("@/components/onboarding", () => ({ DashboardOnboardingWrapper: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/trial-banner", () => ({ TrialBanner: () => null }));
vi.mock("@/components/suki-assistant", () => ({ SukiAssistant: () => null }));

describe("booking action accessible name", () => {
  it("regression: includes the mobile visible Book label in the accessible name", () => {
    render(<AdaptiveAppShell><p>Today</p></AdaptiveAppShell>);
    expect(screen.getByRole("link", { name: "Book new appointment" })).toHaveAttribute("href", "/appointments?new=1");
  });
});
