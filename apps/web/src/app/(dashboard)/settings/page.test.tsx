import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "./page";

const { apiRequestMock, useAuthSyncMock, useFeatureFlagsMock, useWorkspaceMock, useSearchParamsMock } =
  vi.hoisted(() => ({
    apiRequestMock: vi.fn(),
    useAuthSyncMock: vi.fn(),
    useFeatureFlagsMock: vi.fn(),
    useWorkspaceMock: vi.fn(),
    useSearchParamsMock: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useSearchParams: useSearchParamsMock,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue("token") }),
}));

vi.mock("@/hooks/use-auth-sync", () => ({
  useAuthSync: useAuthSyncMock,
}));

vi.mock("@/hooks/use-feature-flags", () => ({
  useFeatureFlags: useFeatureFlagsMock,
}));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: useWorkspaceMock,
}));

vi.mock("@/lib/api", () => ({
  apiRequest: apiRequestMock,
}));

vi.mock("@/lib/dev-mode", () => ({
  isDevMode: () => false,
}));

vi.mock("@/lib/dev-store", () => ({
  getDevApiUrl: () => "",
  setDevApiUrl: vi.fn(),
  getDevMockLatencyMs: () => 0,
  setDevMockLatencyMs: vi.fn(),
  getDevMockFailure: () => false,
  setDevMockFailure: vi.fn(),
  clearDevOverrides: vi.fn(),
}));

const featureFlags = {
  workspace_global_enabled: true,
  crm_mode_toggle_enabled: true,
  ai_usage_transparency_enabled: true,
  onboarding_v2_enabled: true,
  founder_led_mode_enabled: true,
  public_signup_enabled: false,
  self_serve_billing_enabled: false,
  annual_billing_checkout_enabled: false,
  manual_billing_controls_enabled: true,
};

function installDefaultMocks(
  planType: "free" | "growth",
  automationMessageTemplates = {},
  patchAutomationSettings: (body: { messageTemplates?: unknown }) => unknown =
    (body) => ({
      appointmentRemindersEnabled: true,
      appointmentReminder72hEnabled: false,
      inactivityWinbackEnabled: true,
      inactivityDays: 60,
      autoSendChannel: "sms",
      messageTemplates: body.messageTemplates ?? automationMessageTemplates,
    }),
) {
  useSearchParamsMock.mockReturnValue({ get: () => null });
  useAuthSyncMock.mockReturnValue({ data: { organization: { id: "org-1" } } });
  useFeatureFlagsMock.mockReturnValue(featureFlags);
  useWorkspaceMock.mockReturnValue({
    loading: false,
    error: null,
    activeBusinessId: "biz-1",
    businesses: [{ id: "biz-1", name: "Main", businessType: "salon" }],
    refetch: vi.fn(),
    setActiveBusinessId: vi.fn(),
  });
  apiRequestMock.mockImplementation(async (path: string, options?: { body?: string }) => {
    if (path === "/organizations/me") {
      return { organization: { id: "org-1", name: "Tyvera Org" } };
    }
    if (path === "/businesses") {
      return {
        businesses: [
          { id: "biz-1", name: "Main", businessType: "salon", crmMode: "lite" },
        ],
      };
    }
    if (path === "/billing/status") {
      return {
        status: "ok",
        planType,
        readOnly: false,
        billingStatus: "free_active",
        currentPlan: planType,
        subscription: null,
      };
    }
    if (path === "/ai/usage/summary") {
      return {
        plan: planType,
        month: "2026-06",
        tokensUsed: planType === "growth" ? 100 : 0,
        tokensLimit: planType === "growth" ? 1000 : 0,
        requestsUsed: planType === "growth" ? 10 : 0,
        requestsLimit: planType === "growth" ? 100 : 0,
        aiEnabled: true,
        softCapPct: 90,
        allowedFeatures: planType === "growth" ? ["drafting"] : [],
        resetDate: "2026-07-01",
        dailyTokensUsed: 0,
        dailyTokensLimit: 0,
        dailyTokensRemaining: 0,
        dailyRequestsUsed: 0,
        dailyRequestsLimit: 0,
        dailyRequestsRemaining: 0,
        dailyResetDateTime: "2026-06-04T00:00:00.000Z",
        projectedDaysToLimit: null,
      };
    }
    if (path === "/ai/usage/breakdown?groupBy=feature") {
      return { items: [] };
    }
    if (path === "/messaging/sms-usage") {
      return {
        included: 0,
        addon: 0,
        used: 0,
        total: 0,
        remaining: 0,
        at80Pct: false,
        at100Pct: false,
        pausedReason: "none",
      };
    }
    if (path === "/messaging/email-usage") {
      return {
        included: 100,
        used: 0,
        total: 100,
        remaining: 100,
        at80Pct: false,
        at100Pct: false,
      };
    }
    if (path.startsWith("/automation/settings?businessId=")) {
      return {
        appointmentRemindersEnabled: true,
        appointmentReminder72hEnabled: false,
        inactivityWinbackEnabled: true,
        inactivityDays: 60,
        autoSendChannel: "sms",
        messageTemplates: automationMessageTemplates,
      };
    }
    if (path === "/automation/settings") {
      const body =
        typeof options?.body === "string" ? JSON.parse(options.body) : {};
      return patchAutomationSettings(body);
    }
    if (path.startsWith("/customers/templates?businessId=")) {
      return { templates: [] };
    }
    if (path.startsWith("/customers/default-template?businessId=")) {
      return { template: null };
    }
    throw new Error(`Unexpected path: ${path}`);
  });
}

describe("SettingsPage AI visibility", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it("hides AI usage and refine actions on free plans", async () => {
    installDefaultMocks("free");

    render(<SettingsPage />);

    expect(await screen.findByText(/Messaging Usage Caps/i)).toBeInTheDocument();
    expect(screen.queryByText(/AI Usage & Quotas/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Refine with AI/i })).not.toBeInTheDocument();
  });

  it("shows AI usage and refine actions on Growth plans", async () => {
    installDefaultMocks("growth");

    render(<SettingsPage />);

    expect(await screen.findByText(/AI Usage & Quotas/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Refine with AI/i }).length).toBeGreaterThan(0);
  });
});

describe("SettingsPage message templates", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it("shows default template text when the API returns an empty template map", async () => {
    installDefaultMocks("free");

    render(<SettingsPage />);

    expect(
      await screen.findByDisplayValue(
        "Hi {customerName}! Your appointment{staffName} is confirmed for {dateTime}.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        "Reminder: Your appointment{staffName} is tomorrow. Reschedule: {link}.",
      ),
    ).toBeInTheDocument();
  });

  it("loads saved template text and confirms blur autosave", async () => {
    installDefaultMocks("free", {
      appointment_confirmation: {
        sms: "Saved confirmation for {customerName}",
      },
    });

    render(<SettingsPage />);

    const input = await screen.findByDisplayValue(
      "Saved confirmation for {customerName}",
    );

    fireEvent.change(input, {
      target: { value: "Updated confirmation for {customerName}" },
    });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/automation/settings",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining(
            "Updated confirmation for {customerName}",
          ),
        }),
      );
    });
    expect(
      await screen.findByText("Message template saved."),
    ).toBeInTheDocument();
  });

  it("shows loading and error statuses for template autosave", async () => {
    let rejectSave: (error: Error) => void = () => {};
    installDefaultMocks(
      "free",
      {
        appointment_confirmation: {
          sms: "Saved confirmation for {customerName}",
        },
      },
      () =>
        new Promise((_resolve, reject) => {
          rejectSave = reject;
        }),
    );

    render(<SettingsPage />);

    const input = await screen.findByDisplayValue(
      "Saved confirmation for {customerName}",
    );
    fireEvent.change(input, {
      target: { value: "Broken confirmation for {customerName}" },
    });
    fireEvent.blur(input);

    expect(await screen.findByText("Saving message template...")).toBeInTheDocument();

    rejectSave(new Error("Save failed"));

    expect(await screen.findByText("Save failed")).toBeInTheDocument();
  });
});
