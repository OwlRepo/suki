import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SukiAssistant } from "./suki-assistant";

const { usePlanCapabilitiesMock } = vi.hoisted(() => ({
  usePlanCapabilitiesMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue("token") }),
}));

vi.mock("@/hooks/use-plan-capabilities", () => ({
  usePlanCapabilities: usePlanCapabilitiesMock,
}));

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(async (path: string) => {
    if (path.startsWith("/ai/usage/summary")) {
      return {
        tokensUsed: 100,
        tokensLimit: 1000,
        requestsUsed: 10,
        requestsLimit: 100,
        resetDate: "2026-06-01",
        dailyTokensUsed: 50,
        dailyTokensLimit: 200,
        dailyRequestsUsed: 2,
        dailyRequestsLimit: 10,
        dailyResetDateTime: "2026-05-10T16:00:00.000Z",
        aiEnabled: true,
      };
    }
    return { domain: "help", humanReadable: "Open Customers to add a customer." };
  }),
}));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ activeBusinessId: "biz-1" }),
}));

describe("SukiAssistant", () => {
  beforeEach(() => {
    for (const key of ["localStorage", "sessionStorage"]) {
      const store = new Map<string, string>();
      vi.stubGlobal(key, {
        getItem: (name: string) => store.get(name) ?? null,
        setItem: (name: string, value: string) => store.set(name, value),
        removeItem: (name: string) => store.delete(name),
      });
    }
    vi.stubEnv("NEXT_PUBLIC_FF_SUKI_ASSISTANT_ENABLED", "true");
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
  });

  afterEach(() => vi.unstubAllGlobals());

  it("regression: restores legacy coachmark dismissal and collapsed header preferences", async () => {
    localStorage.setItem("tyvera-assistant-coachmark-dismissed-v1", "1");
    sessionStorage.setItem("tyvera-assistant-header-collapsed-v1", "1");
    render(<SukiAssistant />);
    expect(screen.queryByText("Try Suki Assistant")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /open suki assistant/i }));
    expect(await screen.findByRole("button", { name: /expand assistant header/i })).toBeInTheDocument();
    expect(screen.queryByText(/ai usage snapshot/i)).not.toBeInTheDocument();
    expect(localStorage.getItem("tyvera-assistant-coachmark-dismissed-v1")).toBe("1");
    expect(sessionStorage.getItem("tyvera-assistant-header-collapsed-v1")).toBe("1");
  });

  it("regression: canonical assistant preferences override legacy dismissal and collapse values", async () => {
    localStorage.setItem("tyvera-assistant-coachmark-dismissed-v1", "1");
    localStorage.setItem("suki-assistant-coachmark-dismissed-v1", "0");
    sessionStorage.setItem("tyvera-assistant-header-collapsed-v1", "1");
    sessionStorage.setItem("suki-assistant-header-collapsed-v1", "0");
    render(<SukiAssistant />);
    expect(screen.getByText("Try Suki Assistant")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /open suki assistant/i }));
    expect(await screen.findByText(/ai usage snapshot/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /collapse assistant header/i })).toBeInTheDocument();
  });

  it("hides the assistant launcher on plans without AI access", () => {
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

    render(<SukiAssistant />);

    expect(screen.queryByRole("button", { name: /open suki assistant/i })).not.toBeInTheDocument();
  });

  it("opens panel, shows usage strip, and suggested prompts", async () => {
    render(<SukiAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open suki assistant/i }));

    await waitFor(() => {
      expect(screen.getByText(/daily ai limit/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/what can i ask/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /how do i add a customer/i })).toBeInTheDocument();
  });

  it("shows helper drawer content", async () => {
    render(<SukiAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open suki assistant/i }));

    fireEvent.click(screen.getByRole("button", { name: /what can i ask\?/i }));
    expect(await screen.findByText(/daily tasks/i)).toBeInTheDocument();
  });

  it("supports collapsing and expanding the header snapshot block", async () => {
    render(<SukiAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open suki assistant/i }));

    expect(await screen.findByText(/ai usage snapshot/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /collapse assistant header/i }));
    expect(screen.queryByText(/ai usage snapshot/i)).not.toBeInTheDocument();
    expect(screen.getByText(/status:/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /expand assistant header/i }));
    expect(await screen.findByText(/ai usage snapshot/i)).toBeInTheDocument();
  });

  it("renders suggestion chips in a horizontal scroll row", async () => {
    render(<SukiAssistant />);
    fireEvent.click(screen.getByRole("button", { name: /open suki assistant/i }));

    const chipRow = await screen.findByTestId("assistant-prompt-row");
    expect(chipRow.className).toContain("overflow-x-auto");
    expect(chipRow.className).toContain("flex-nowrap");
  });
});
