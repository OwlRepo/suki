"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@suki/ui";
import { SettingsSectionCard } from "@/components/ui/settings-section-card";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { useWorkspace } from "@/contexts/workspace-context";
import { hasClerk } from "@/lib/clerk";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBanner } from "@/components/ui/status-banner";
import { fromError } from "@/lib/ui-feedback";
import { isDevMode } from "@/lib/dev-mode";
import {
  getDevApiUrl,
  setDevApiUrl,
  getDevMockLatencyMs,
  setDevMockLatencyMs,
  getDevMockFailure,
  setDevMockFailure,
  clearDevOverrides,
} from "@/lib/dev-store";

/** Searchable section IDs for settings. Used for quick-jump and filtering. */
const SETTINGS_SECTION_IDS = [
  "organization",
  "businesses",
  "automation",
  "messaging",
  "billing",
  "ai-usage",
  "dev-tools",
] as const;

/** Index of searchable terms per section. Lowercase for matching. */
const SETTINGS_SEARCH_INDEX: Record<
  (typeof SETTINGS_SECTION_IDS)[number],
  string[]
> = {
  organization: ["organization", "workspace", "name", "email", "receipt"],
  businesses: ["businesses", "business", "crm", "customers", "appointments"],
  automation: [
    "automation",
    "reminders",
    "appointment",
    "inactivity",
    "winback",
    "follow-up",
    "sms",
    "email",
    "channel",
  ],
  messaging: [
    "messaging",
    "sms",
    "add-on",
    "usage",
    "text",
    "credits",
    "buy",
  ],
  billing: [
    "billing",
    "plan",
    "subscription",
    "upgrade",
    "downgrade",
    "basic",
    "grow",
    "pro",
    "payment",
  ],
  "ai-usage": [
    "ai",
    "usage",
    "tokens",
    "quota",
    "limit",
    "soft cap",
  ],
  "dev-tools": ["dev", "developer", "simulation", "mock", "api"],
};

type PlanType = "starter" | "growth" | "ai_pro";

interface Organization {
  id: string;
  name: string;
}

interface Business {
  id: string;
  name: string;
  businessType: string;
  crmMode?: "lite" | "full";
}

interface BillingStatus {
  status: string;
  planType: string;
  readOnly?: boolean;
  subscription: { planType?: string; status?: string; currentPeriodEnd?: string } | null;
}

const PLAN_LABELS: Record<string, string> = {
  starter: "Basic",
  growth: "Grow",
  ai_pro: "Pro",
};

const PLAN_PRICES: Record<string, number> = {
  starter: 499,
  growth: 999,
  ai_pro: 1499,
};

interface SmsUsage {
  included: number;
  addon: number;
  used: number;
  total: number;
  remaining: number;
  pausedReason: string;
  at80Pct: boolean;
  at100Pct: boolean;
}

const PAUSED_REASON_MESSAGES: Record<string, string> = {
  none: "",
  cap_reached: "SMS cap reached. Auto-messages paused. Buy add-on below to resume.",
  billing_past_due: "Messages paused until billing is fixed. Update your payment to resume.",
  provider_down: "SMS provider temporarily unavailable. Messages will retry.",
  manual_pause: "Messaging is manually paused.",
};

function UpgradeButton({
  planType,
  currentPlan,
  getToken,
  onSuccess,
  onError,
  readOnly,
}: {
  planType: string;
  currentPlan: string;
  getToken: () => Promise<string | null>;
  onSuccess?: () => void;
  onError?: (message: string) => void;
  readOnly?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const price = PLAN_PRICES[planType] ?? 0;
  const isCurrent = currentPlan === planType;
  const isUpgrade =
    (planType === "ai_pro" && currentPlan !== "ai_pro") ||
    (planType === "growth" && currentPlan === "starter");
  const isDowngrade =
    (planType === "starter" && currentPlan !== "starter") ||
    (planType === "growth" && currentPlan === "ai_pro");

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiRequest<{ checkoutUrl: string }>("/billing/checkout", {
        method: "POST",
        token,
        body: JSON.stringify({ planType }),
      });
      if (res.checkoutUrl) window.location.href = res.checkoutUrl;
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Checkout unavailable. Is PayMongo configured?");
    } finally {
      setLoading(false);
    }
  };

  const handleDowngrade = async () => {
    const planLabel = PLAN_LABELS[planType] ?? planType;
    const message =
      `Switching to ${planLabel} will reduce your plan features. ` +
      `You may lose access to advanced CRM, automation, and AI features. ` +
      `Are you sure you want to switch to ${planLabel}?`;
    if (!confirm(message)) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      await apiRequest("/billing/downgrade", {
        method: "POST",
        token,
        body: JSON.stringify({ planType }),
      });
      onSuccess?.();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Downgrade failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (isCurrent) return null;
  if (readOnly && isUpgrade) return null;
  return (
    <Button
      size="lg"
      variant={isUpgrade ? "default" : "outline"}
      onClick={isDowngrade ? handleDowngrade : handleUpgrade}
      disabled={loading}
      className="min-h-[48px]"
    >
      {loading ? "..." : isDowngrade ? `Switch to ${PLAN_LABELS[planType] ?? planType}` : `${PLAN_LABELS[planType] ?? planType} – ₱${price}/mo`}
    </Button>
  );
}

function SettingsPageContent() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const { data: syncData } = useAuthSync();
  const workspace = useWorkspace();
  const flags = useFeatureFlags();
  const [, setOrg] = useState<Organization | null>(null);
  const [orgName, setOrgName] = useState("");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingOrg, setSavingOrg] = useState(false);
  const [editingBiz, setEditingBiz] = useState<string | null>(null);
  const [editBizName, setEditBizName] = useState("");
  const [simulatedPlan, setSimulatedPlan] = useState<PlanType | null>(null);
  const [devSwitchLoading, setDevSwitchLoading] = useState(false);
  const [devApiUrl, setDevApiUrlState] = useState("");
  const [devMockLatencyMs, setDevMockLatencyMsState] = useState(0);
  const [devMockFailure, setDevMockFailureState] = useState(false);
  const [aiUsage, setAiUsage] = useState<{
    plan: string;
    month: string;
    tokensUsed: number;
    tokensLimit: number;
    requestsUsed: number;
    requestsLimit: number;
    aiEnabled: boolean;
    softCapPct: number;
    allowedFeatures: string[];
    resetDate: string;
    projectedDaysToLimit: number | null;
  } | null>(null);
  const [aiBreakdown, setAiBreakdown] = useState<{ items: Array<{ key: string; tokens: number; requests: number }> } | null>(null);
  const [aiPoliciesLoading, setAiPoliciesLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [smsUsage, setSmsUsage] = useState<SmsUsage | null>(null);
  interface AutomationSettingsApi {
    appointmentRemindersEnabled: boolean;
    appointmentReminder72hEnabled: boolean;
    inactivityWinbackEnabled: boolean;
    inactivityDays: number;
    autoSendChannel: "sms" | "email";
  }
  const automationDefaults: AutomationSettingsApi = {
    appointmentRemindersEnabled: true,
    appointmentReminder72hEnabled: false,
    inactivityWinbackEnabled: true,
    inactivityDays: 60,
    autoSendChannel: "sms",
  };
  const [automationSettingsByBiz, setAutomationSettingsByBiz] = useState<Record<string, AutomationSettingsApi>>({});
  const [automationSavingByBiz, setAutomationSavingByBiz] = useState<Record<string, boolean>>({});
  const [inactivityDraftByBiz, setInactivityDraftByBiz] = useState<Record<string, string>>({});
  const [addonLoading, setAddonLoading] = useState(false);
  const [settingsSearch, setSettingsSearch] = useState("");

  const effectivePlan = simulatedPlan ?? (billing?.planType as PlanType | undefined) ?? "starter";

  const visibleSections = useMemo(() => {
    const q = settingsSearch.trim().toLowerCase();
    if (!q) return new Set(SETTINGS_SECTION_IDS);
    const matched = new Set<(typeof SETTINGS_SECTION_IDS)[number]>();
    for (const id of SETTINGS_SECTION_IDS) {
      const terms = SETTINGS_SEARCH_INDEX[id] ?? [];
      if (terms.some((t) => t.includes(q) || q.includes(t))) {
        matched.add(id);
      }
    }
    return matched;
  }, [settingsSearch]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDevApiUrlState(getDevApiUrl() ?? "");
    setDevMockLatencyMsState(getDevMockLatencyMs());
    setDevMockFailureState(getDevMockFailure());
  }, []);

  const refetchBilling = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const billRes = await apiRequest<BillingStatus>("/billing/status", { token });
      setBilling(billRes);
    } catch {
      // ignore
    }
  };

  const refetchSmsUsage = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const u = await apiRequest<SmsUsage>("/messaging/sms-usage", { token });
      setSmsUsage(u);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!syncData) return;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const [orgRes, bizRes, billRes, aiRes, breakdownRes, smsRes] = await Promise.all([
          apiRequest<{ organization: Organization }>("/organizations/me", { token }),
          apiRequest<{ businesses: Business[] }>("/businesses", { token }),
          apiRequest<BillingStatus>("/billing/status", { token }),
          apiRequest<{
            plan: string;
            month: string;
            tokensUsed: number;
            tokensLimit: number;
            requestsUsed: number;
            requestsLimit: number;
            aiEnabled: boolean;
            softCapPct: number;
            allowedFeatures: string[];
            resetDate: string;
            projectedDaysToLimit: number | null;
          }>("/ai/usage/summary", { token }).catch(() => null),
          apiRequest<{ items: Array<{ key: string; tokens: number; requests: number }> }>("/ai/usage/breakdown?groupBy=feature", { token }).catch(() => null),
          apiRequest<SmsUsage>("/messaging/sms-usage", { token }).catch(() => null),
        ]);
        setOrg(orgRes.organization ?? null);
        setAiUsage(aiRes);
        setAiBreakdown(breakdownRes ?? null);
        setOrgName(orgRes.organization?.name ?? "");
        setBusinesses(bizRes.businesses);
        setBilling(billRes);
        setSmsUsage(smsRes ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, [syncData, getToken]);

  useEffect(() => {
    const addon = searchParams?.get("addon");
    const checkout = searchParams?.get("checkout");
    if (addon === "success") {
      setFeedback({ type: "success", message: "SMS add-on purchased. Credits will appear shortly." });
      setTimeout(() => setFeedback(null), 5000);
      refetchSmsUsage();
      window.history.replaceState({}, "", "/settings");
    } else if (checkout === "success") {
      setFeedback({ type: "success", message: "Subscription updated successfully." });
      setTimeout(() => setFeedback(null), 5000);
      refetchBilling();
      window.history.replaceState({}, "", "/settings");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!businesses.length || (effectivePlan !== "growth" && effectivePlan !== "ai_pro")) return;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const results = await Promise.all(
          businesses.map(async (b) => {
            const s = await apiRequest<AutomationSettingsApi>(
              `/automation/settings?businessId=${encodeURIComponent(b.id)}`,
              { token },
            ).catch(() => automationDefaults);
            return {
              id: b.id,
              ...automationDefaults,
              ...s,
              appointmentRemindersEnabled: s?.appointmentRemindersEnabled ?? automationDefaults.appointmentRemindersEnabled,
              appointmentReminder72hEnabled: s?.appointmentReminder72hEnabled ?? automationDefaults.appointmentReminder72hEnabled,
              inactivityWinbackEnabled: s?.inactivityWinbackEnabled ?? automationDefaults.inactivityWinbackEnabled,
              inactivityDays: typeof s?.inactivityDays === "number" ? s.inactivityDays : automationDefaults.inactivityDays,
              autoSendChannel: (s?.autoSendChannel as "sms" | "email") ?? automationDefaults.autoSendChannel,
            };
          }),
        );
        const map: Record<string, AutomationSettingsApi> = {};
        for (const r of results) map[r.id] = r as AutomationSettingsApi;
        setAutomationSettingsByBiz(map);
      } catch {
        // ignore
      }
    })();
  }, [businesses, effectivePlan, getToken]);

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) return;
    setSavingOrg(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiRequest<{ organization: Organization }>("/organizations/me", {
        method: "PATCH",
        token,
        body: JSON.stringify({ name: orgName.trim() }),
      });
      setOrg(res.organization);
      setFeedback({ type: "success", message: "Organization name saved." });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({ type: "error", message: fromError(err, "Failed to save. Please try again.") });
    } finally {
      setSavingOrg(false);
    }
  };

  const handleSaveBiz = async (id: string) => {
    if (!editBizName.trim()) return;
    try {
      const token = await getToken();
      if (!token) return;
      await apiRequest(`/businesses/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ name: editBizName.trim() }),
      });
      setBusinesses((prev) =>
        prev.map((b) => (b.id === id ? { ...b, name: editBizName.trim() } : b)),
      );
      setEditingBiz(null);
      setFeedback({ type: "success", message: "Business name saved." });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({ type: "error", message: fromError(err, "Failed to save business. Please try again.") });
    }
  };

  const handleCrmModeChange = async (id: string, crmMode: "lite" | "full") => {
    if (effectivePlan === "starter") return;
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiRequest<{ business: Business }>(`/businesses/${id}/crm-mode`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ crmMode }),
      });
      setBusinesses((prev) =>
        prev.map((b) => (b.id === id ? { ...b, crmMode: res.business.crmMode ?? b.crmMode } : b)),
      );
      workspace?.refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update mode";
      if (msg === "CRM_FULL_REQUIRES_UPGRADE") {
        setFeedback({ type: "error", message: "Full CRM mode requires Growth or AI Pro plan. Upgrade in Billing below." });
      } else {
        setFeedback({ type: "error", message: fromError(err, "Failed to update mode. Please try again.") });
      }
      setTimeout(() => setFeedback(null), 6000);
    }
  };

  const updateAutomationSettings = async (
    businessId: string,
    patch: Partial<AutomationSettingsApi>,
  ) => {
    setAutomationSavingByBiz((p) => ({ ...p, [businessId]: true }));
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiRequest<AutomationSettingsApi>("/automation/settings", {
        method: "PATCH",
        token,
        body: JSON.stringify({ businessId, ...patch }),
      });
      setAutomationSettingsByBiz((prev) => ({
        ...prev,
        [businessId]: {
          ...automationDefaults,
          ...prev[businessId],
          ...res,
        } as AutomationSettingsApi,
      }));
      setFeedback({ type: "success", message: "Automation settings updated." });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({ type: "error", message: fromError(err, "Failed to update. Please try again.") });
    } finally {
      setAutomationSavingByBiz((p) => ({ ...p, [businessId]: false }));
    }
  };

  if (loading) return <p className="text-muted-foreground text-base">Loading settings…</p>;

  const sectionLabels: Record<(typeof SETTINGS_SECTION_IDS)[number], string> = {
    organization: "Organization",
    businesses: "Businesses",
    automation: "Automation",
    messaging: "Messaging & SMS",
    billing: "Billing",
    "ai-usage": "AI Usage",
    "dev-tools": "Dev Tools",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        plainLanguageDescription="Manage your organization, businesses, billing, and automation."
        whatThisPageIsFor="Change your workspace name, business details, plan, reminders, and AI."
        whatToDoNext="Use the search below to find a setting, or open any section to edit."
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
        <input
          type="search"
          value={settingsSearch}
          onChange={(e) => setSettingsSearch(e.target.value)}
          placeholder="Search settings (e.g. billing, reminders, SMS)"
          aria-label="Search settings"
          className="w-full max-w-md min-h-[48px] pl-10 pr-4 text-base rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        />
      </div>

      {settingsSearch.trim() && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className="text-sm font-medium text-foreground mb-2">Jump to</p>
          <div className="flex flex-wrap gap-2">
            {SETTINGS_SECTION_IDS.filter((id) => visibleSections.has(id)).map((id) => (
              <a
                key={id}
                href={`#${id}`}
                className="min-h-[44px] inline-flex items-center px-4 rounded-md border border-border bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {sectionLabels[id]}
              </a>
            ))}
          </div>
          {visibleSections.size === 0 && (
            <p className="text-sm text-muted-foreground">No settings match &quot;{settingsSearch}&quot;. Try a different search.</p>
          )}
        </div>
      )}

      {feedback && (
        <StatusBanner
          variant={feedback.type}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
          className="mt-4"
        />
      )}

      {(billing?.readOnly || (smsUsage?.pausedReason && smsUsage.pausedReason !== "none")) && (
        <StatusBanner
          variant="warning"
          message={
            billing?.readOnly
              ? "Messages paused until billing is fixed. Update your payment to resume."
              : PAUSED_REASON_MESSAGES[smsUsage!.pausedReason] ?? `Messaging paused: ${smsUsage!.pausedReason}`
          }
          className="mt-4"
        />
      )}

      <div className="space-y-5">
        <SettingsSectionCard
          id="organization"
          title="Organization"
          description="Your workspace name. Appears in emails and receipts. You can change it anytime."
          visible={visibleSections.has("organization")}
        >
          <form onSubmit={handleSaveOrg} className="flex flex-wrap items-center gap-3">
            <Input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Organization name"
              className="max-w-md min-h-[48px] text-base"
            />
            <Button type="submit" disabled={savingOrg} size="lg" className="min-h-[48px] px-6">
              {savingOrg ? "Saving…" : "Save"}
            </Button>
          </form>
        </SettingsSectionCard>

        <SettingsSectionCard
          id="businesses"
          title="Businesses"
          description="Each business has its own customers and appointments. Edit names or switch CRM mode here."
          visible={visibleSections.has("businesses")}
        >
          <ul className="space-y-4 divide-y divide-border">
            {businesses.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0">
                {editingBiz === b.id ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <Input
                      value={editBizName}
                      onChange={(e) => setEditBizName(e.target.value)}
                      placeholder="Business name"
                      className="min-w-[200px] min-h-[48px] text-base"
                    />
                    <Button size="lg" onClick={() => handleSaveBiz(b.id)} className="min-h-[48px]">
                      Save
                    </Button>
                    <Button size="lg" variant="outline" onClick={() => setEditingBiz(null)} className="min-h-[48px]">
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-4">
                      <div>
                        <span className="font-medium text-base">{b.name}</span>
                        <span className="ml-2 text-sm text-muted-foreground capitalize">
                          {b.businessType}
                        </span>
                      </div>
                      {(effectivePlan === "growth" || effectivePlan === "ai_pro") &&
                        flags.crm_mode_toggle_enabled && (
                          <Select
                            value={b.crmMode ?? "lite"}
                            onValueChange={(v) => handleCrmModeChange(b.id, v as "lite" | "full")}
                          >
                            <SelectTrigger size="lg" className="min-w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="lite" size="lg">CRM Lite</SelectItem>
                              <SelectItem value="full" size="lg">CRM Full</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                    </div>
                    <Button size="lg" variant="outline" onClick={() => { setEditingBiz(b.id); setEditBizName(b.name); }} className="min-h-[48px]">
                      Edit
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {businesses.length === 0 && (
            <p className="text-base text-muted-foreground">No businesses yet. Create one in Setup.</p>
          )}
        </SettingsSectionCard>

        {billing?.readOnly && (
          <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
            <p className="text-base font-medium text-foreground">
              Read-only mode — Your subscription needs attention. Update billing to make changes.
            </p>
          </div>
        )}

        {(effectivePlan === "growth" || effectivePlan === "ai_pro") && businesses.length > 0 && (
          <SettingsSectionCard
            id="automation"
            title="Automation Controls"
            description="Choose how Suki sends automated reminders and follow-ups for each business."
            visible={visibleSections.has("automation")}
          >
            <ul className="space-y-6">
              {businesses.map((b) => {
                const s = automationSettingsByBiz[b.id] ?? automationDefaults;
                const saving = automationSavingByBiz[b.id];
                const draft = inactivityDraftByBiz[b.id];
                const inactivityVal = draft !== undefined ? draft : String(s.inactivityDays);
                return (
                  <li key={b.id} className="rounded-lg border border-border bg-muted/30 p-5 space-y-6">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-base">{b.name}</span>
                      {saving && <span className="text-sm text-muted-foreground">Saving…</span>}
                    </div>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label className="text-base">Send reminders by SMS or email</Label>
                        <p className="text-sm text-muted-foreground">
                          Choose how customers receive appointment reminders.
                        </p>
                        <Select
                          value={s.autoSendChannel}
                          disabled={saving}
                          onValueChange={(value) =>
                            updateAutomationSettings(b.id, {
                              autoSendChannel: value as "sms" | "email",
                            })
                          }
                        >
                          <SelectTrigger size="lg" className="min-w-[160px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sms" size="lg">SMS</SelectItem>
                            <SelectItem value="email" size="lg">Email</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-start justify-between gap-6">
                        <div className="space-y-1 min-w-0">
                          <Label htmlFor={`${b.id}-appt-reminders`} className="text-base">
                            Send appointment reminders
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Automatically remind customers 24 hours before their appointment.
                          </p>
                        </div>
                        <Switch
                          id={`${b.id}-appt-reminders`}
                          size="lg"
                          checked={s.appointmentRemindersEnabled}
                          disabled={saving}
                          onCheckedChange={(checked) =>
                            updateAutomationSettings(b.id, {
                              appointmentRemindersEnabled: checked,
                            })
                          }
                        />
                      </div>

                      <div className="flex items-start justify-between gap-6">
                        <div className="space-y-1 min-w-0">
                          <Label htmlFor={`${b.id}-72h-reminder`} className="text-base">
                            Also send 3-day reminder
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {s.appointmentRemindersEnabled
                              ? "Sends an extra reminder 3 days before the appointment."
                              : "Turn on appointment reminders above to use this."}
                          </p>
                        </div>
                        <Switch
                          id={`${b.id}-72h-reminder`}
                          size="lg"
                          checked={s.appointmentReminder72hEnabled}
                          disabled={saving || !s.appointmentRemindersEnabled}
                          onCheckedChange={(checked) =>
                            updateAutomationSettings(b.id, {
                              appointmentReminder72hEnabled: checked,
                            })
                          }
                        />
                      </div>

                      <div className="flex items-start justify-between gap-6">
                        <div className="space-y-1 min-w-0">
                          <Label htmlFor={`${b.id}-inactivity-winback`} className="text-base">
                            Reach out to inactive customers
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Automatically send a gentle reminder to customers who haven&apos;t visited in a while.
                          </p>
                        </div>
                        <Switch
                          id={`${b.id}-inactivity-winback`}
                          size="lg"
                          checked={s.inactivityWinbackEnabled}
                          disabled={saving}
                          onCheckedChange={(checked) =>
                            updateAutomationSettings(b.id, {
                              inactivityWinbackEnabled: checked,
                            })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`${b.id}-inactivity-days`} className="text-base">
                          How many days of no visits before outreach?
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Send a gentle reminder after this many days of inactivity (1–365 days). Enter 60 for about 2 months.
                        </p>
                        <Input
                          id={`${b.id}-inactivity-days`}
                          type="number"
                          min={1}
                          max={365}
                          value={inactivityVal}
                          disabled={saving}
                          onChange={(e) => setInactivityDraftByBiz((p) => ({ ...p, [b.id]: e.target.value }))}
                          onBlur={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (!Number.isNaN(v) && v >= 1 && v <= 365) {
                              updateAutomationSettings(b.id, { inactivityDays: v });
                              setInactivityDraftByBiz((p) => {
                                const next = { ...p };
                                delete next[b.id];
                                return next;
                              });
                            } else {
                              setInactivityDraftByBiz((p) => ({
                                ...p,
                                [b.id]: String(s.inactivityDays),
                              }));
                            }
                          }}
                          className="w-28 min-h-[48px] text-base"
                        />
                        {draft !== undefined && (Number.isNaN(parseInt(draft, 10)) || parseInt(draft, 10) < 1 || parseInt(draft, 10) > 365) && (
                          <p className="text-sm text-amber-600">Enter a number between 1 and 365.</p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </SettingsSectionCard>
        )}

        {(effectivePlan === "growth" || effectivePlan === "ai_pro") && (
          <SettingsSectionCard
            id="messaging"
            title="Messaging & SMS"
            description="SMS usage, add-on packs, and text credits."
            visible={visibleSections.has("messaging")}
          >
            <div className="space-y-6 max-w-lg">
              {smsUsage != null && (
                <div>
                  <p className="text-base font-medium text-foreground">SMS usage this month</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {smsUsage.used} / {smsUsage.total} used
                    {smsUsage.total > 0 && ` (${smsUsage.included} included${smsUsage.addon > 0 ? ` + ${smsUsage.addon} add-on` : ""})`}
                  </p>
                  <div className="mt-3 h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        smsUsage.at100Pct ? "bg-destructive" : smsUsage.at80Pct ? "bg-amber-500" : "bg-primary"
                      }`}
                      style={{ width: `${smsUsage.total > 0 ? Math.min(100, (smsUsage.used / smsUsage.total) * 100) : 0}%` }}
                    />
                  </div>
                  {smsUsage.at80Pct && !smsUsage.at100Pct && (
                    <p className="mt-2 text-sm text-amber-600">Approaching limit. Consider buying an add-on below.</p>
                  )}
                </div>
              )}
              <div>
                <p className="text-base font-medium text-foreground">Buy +300 SMS for ₱300</p>
                <p className="mt-1 text-sm text-muted-foreground">One-time purchase. No auto-charge.</p>
                <Button
                  size="lg"
                  variant="outline"
                  disabled={addonLoading || billing?.readOnly}
                  className="mt-3 min-h-[48px]"
                  onClick={async () => {
                    setAddonLoading(true);
                    try {
                      const token = await getToken();
                      if (!token) return;
                      const res = await apiRequest<{ checkoutUrl: string }>("/billing/sms-addon/purchase", {
                        method: "POST",
                        token,
                        body: JSON.stringify({ confirm: true }),
                      });
                      if (res?.checkoutUrl) window.location.href = res.checkoutUrl;
                    } catch (err) {
                      setFeedback({ type: "error", message: fromError(err, "Add-on purchase unavailable.") });
                      setTimeout(() => setFeedback(null), 6000);
                    } finally {
                      setAddonLoading(false);
                    }
                  }}
                >
                  {addonLoading ? "Redirecting…" : "Buy +300 SMS pack"}
                </Button>
              </div>
            </div>
          </SettingsSectionCard>
        )}

        <SettingsSectionCard
          id="billing"
          title="Billing"
          description="Upgrade or switch plans. You can change or cancel anytime. No lock-in."
          visible={visibleSections.has("billing")}
        >
          <div className="space-y-4 max-w-md">
            <p className="text-sm text-muted-foreground">Current plan</p>
            <p className="text-lg font-semibold">
              {PLAN_LABELS[effectivePlan] ?? effectivePlan}
              {simulatedPlan && (
                <span className="ml-2 text-sm text-amber-600">(simulated)</span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">Status: {billing?.status ?? "none"}</p>
            {billing?.subscription?.currentPeriodEnd && (
              <p className="text-sm text-muted-foreground">
                Current period ends: {new Date(billing.subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              {(["starter", "growth", "ai_pro"] as const).map((plan) => (
                <UpgradeButton
                  key={plan}
                  planType={plan}
                  currentPlan={effectivePlan}
                  getToken={getToken}
                  onSuccess={() => {
                    refetchBilling();
                    refetchSmsUsage();
                  }}
                  onError={(msg) => {
                    setFeedback({ type: "error", message: msg });
                    setTimeout(() => setFeedback(null), 6000);
                  }}
                  readOnly={billing?.readOnly}
                />
              ))}
            </div>
          </div>
        </SettingsSectionCard>

        {aiUsage && (
          <SettingsSectionCard
            id="ai-usage"
            title="AI Usage & Quotas"
            description="AI helps you write messages and summaries. Turn it on for better promos and faster workflows."
            visible={visibleSections.has("ai-usage")}
          >
            <div className="space-y-4 max-w-lg">
              <p className="text-sm text-muted-foreground">Plan: {aiUsage.plan}</p>
              <p className="text-sm text-muted-foreground">
                Tokens: {aiUsage.tokensUsed.toLocaleString()} / {aiUsage.tokensLimit > 0 ? aiUsage.tokensLimit.toLocaleString() : "0"}
              </p>
              <p className="text-sm text-muted-foreground">
                Requests: {aiUsage.requestsUsed} / {aiUsage.requestsLimit}
              </p>
              <p className="text-sm text-muted-foreground">
                Quota resets: {aiUsage.resetDate}
              </p>
              {aiUsage.projectedDaysToLimit != null && aiUsage.projectedDaysToLimit > 0 && (
                <p className="text-sm text-muted-foreground">
                  Projected days to limit: ~{aiUsage.projectedDaysToLimit} (at current pace)
                </p>
              )}
              {aiUsage.allowedFeatures.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Allowed features: {aiUsage.allowedFeatures.join(", ")}
                </p>
              )}
              {aiBreakdown?.items && aiBreakdown.items.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground">Top features this month</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {aiBreakdown.items.slice(0, 5).map((i) => (
                      <li key={i.key}>{i.key}: {i.tokens.toLocaleString()} tokens, {i.requests} requests</li>
                    ))}
                  </ul>
                </div>
              )}
              {aiUsage.tokensLimit === 0 && (
                <p className="text-sm text-amber-600">
                  Upgrade to Growth or AI Pro for AI features.
                </p>
              )}
              {aiUsage.tokensLimit > 0 && (aiUsage.tokensUsed / aiUsage.tokensLimit) >= 0.7 && effectivePlan !== "ai_pro" && (
                <p className="text-sm text-amber-600">
                  Approaching limit. Consider upgrading for higher allowance.
                </p>
              )}
              {aiUsage.tokensLimit > 0 && (
                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-4">
                    <Label htmlFor="ai-enabled" className="text-base">AI enabled</Label>
                    <Switch
                      id="ai-enabled"
                      size="lg"
                      checked={aiUsage.aiEnabled}
                      disabled={aiPoliciesLoading}
                      onCheckedChange={async (checked) => {
                        setAiPoliciesLoading(true);
                        try {
                          const token = await getToken();
                          if (!token) return;
                          await apiRequest("/ai/usage/policies", {
                            method: "PATCH",
                            token,
                            body: JSON.stringify({ aiEnabled: checked }),
                          });
                          setAiUsage((p) => p ? { ...p, aiEnabled: checked } : null);
                          setFeedback({ type: "success", message: "AI settings updated." });
                          setTimeout(() => setFeedback(null), 4000);
                        } catch (err) {
                          setFeedback({ type: "error", message: fromError(err, "Failed to update AI settings. Please try again.") });
                        } finally {
                          setAiPoliciesLoading(false);
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="soft-cap" className="text-base">Soft cap (50–100%)</Label>
                    <p className="text-sm text-muted-foreground">Show a warning when usage reaches this percentage of your limit.</p>
                    <Input
                      id="soft-cap"
                      type="number"
                      min={50}
                      max={100}
                      defaultValue={aiUsage.softCapPct ?? 90}
                      disabled={aiPoliciesLoading}
                      className="w-24 min-h-[48px] text-base"
                      onBlur={async (e) => {
                        const v = parseInt(e.target.value, 10);
                        if (isNaN(v) || v < 50 || v > 100) return;
                        setAiPoliciesLoading(true);
                        try {
                          const token = await getToken();
                          if (!token) return;
                          await apiRequest("/ai/usage/policies", {
                            method: "PATCH",
                            token,
                            body: JSON.stringify({ softCapPct: v }),
                          });
                          setAiUsage((p) => p ? { ...p, softCapPct: v } : null);
                        } catch (err) {
                          setFeedback({ type: "error", message: fromError(err, "Failed to update soft cap. Please try again.") });
                        } finally {
                          setAiPoliciesLoading(false);
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </SettingsSectionCard>
        )}

      {isDevMode && (
        <SettingsSectionCard
          id="dev-tools"
          title="Dev Tools"
          description="Plan simulation, API overrides, and debug helpers. Development only."
          collapsedByDefault
          visible={visibleSections.has("dev-tools")}
        >
          <div className="space-y-6 max-w-2xl">
            <div>
              <p className="text-sm font-medium text-foreground">Plan simulation (UI only)</p>
              <p className="text-xs text-muted-foreground mb-2">
                Override displayed plan without changing backend. Use to test UI behavior across plans.
              </p>
              <div className="flex flex-wrap gap-2">
                {(["starter", "growth", "ai_pro"] as const).map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant={simulatedPlan === p ? "default" : "outline"}
                    onClick={() => setSimulatedPlan(p)}
                  >
                    {p}
                  </Button>
                ))}
                <Button size="sm" variant="ghost" onClick={() => setSimulatedPlan(null)}>
                  Clear simulation
                </Button>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Real plan switch (backend)</p>
              <p className="text-xs text-muted-foreground mb-2">
                Persist plan change in database. Development environment only.
              </p>
              <div className="flex flex-wrap gap-2">
                {(["starter", "growth", "ai_pro"] as const).map((plan) => (
                  <Button
                    key={plan}
                    size="sm"
                    variant={billing?.planType === plan ? "default" : "outline"}
                    disabled={devSwitchLoading || billing?.planType === plan}
                    onClick={async () => {
                      setDevSwitchLoading(true);
                      try {
                        const token = await getToken();
                        if (!token) return;
                        await apiRequest("/billing/dev-switch-plan", {
                          method: "POST",
                          token,
                          body: JSON.stringify({ planType: plan }),
                        });
                        await refetchBilling();
                        setSimulatedPlan(null);
                      } catch (err) {
                        setFeedback({ type: "error", message: fromError(err, "Dev switch failed. Please try again.") });
                      } finally {
                        setDevSwitchLoading(false);
                      }
                    }}
                  >
                    {plan}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">API base URL override</p>
              <p className="text-xs text-muted-foreground mb-2">
                Override NEXT_PUBLIC_API_URL for this session (saved in localStorage).
              </p>
              <div className="flex gap-2">
                <Input
                  value={devApiUrl}
                  onChange={(e) => setDevApiUrlState(e.target.value)}
                  onBlur={() => setDevApiUrl(devApiUrl)}
                  placeholder={process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}
                  className="max-w-md font-mono text-sm"
                />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Mock latency (ms)</p>
              <p className="text-xs text-muted-foreground mb-2">
                Add artificial delay to all API requests.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  value={devMockLatencyMs}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10) || 0;
                    setDevMockLatencyMsState(v);
                    setDevMockLatencyMs(v);
                  }}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">ms</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Mock API failure</p>
              <p className="text-xs text-muted-foreground mb-2">
                Fail all API requests with a dev error.
              </p>
              <Button
                size="sm"
                variant={devMockFailure ? "destructive" : "outline"}
                onClick={() => {
                  setDevMockFailure(!devMockFailure);
                  setDevMockFailureState(!devMockFailure);
                }}
              >
                {devMockFailure ? "On" : "Off"}
              </Button>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Auth / session inspector</p>
              <div className="mt-2 rounded border border-border bg-muted/30 p-3 font-mono text-xs text-muted-foreground space-y-1">
                {syncData ? (
                  <>
                    <p>Org: {syncData.organization?.id ?? "-"} ({syncData.organization?.name ?? "-"})</p>
                    <p>User: {syncData.user?.id ?? "-"}</p>
                  </>
                ) : (
                  <p>Loading sync data...</p>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Cache reset</p>
              <p className="text-xs text-muted-foreground mb-2">
                Clear dev overrides and reload.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  clearDevOverrides();
                  setDevApiUrlState("");
                  setDevMockLatencyMsState(0);
                  setDevMockFailureState(false);
                  setSimulatedPlan(null);
                  window.location.reload();
                }}
              >
                Clear dev overrides and reload
              </Button>
            </div>
          </div>
        </SettingsSectionCard>
      )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  if (!hasClerk) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Clerk authentication is not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to manage settings.
        </p>
      </div>
    );
  }
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading...</p>}>
      <SettingsPageContent />
    </Suspense>
  );
}
