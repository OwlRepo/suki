"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@suki/ui";
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
  const prices: Record<string, number> = { growth: 499, ai_pro: 999 };
  const price = prices[planType] ?? 0;
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
    if (!confirm(`Switch to ${planType}? You may lose access to some features.`)) return;
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
      size="sm"
      variant={isUpgrade ? "default" : "outline"}
      onClick={isDowngrade ? handleDowngrade : handleUpgrade}
      disabled={loading}
    >
      {loading ? "..." : isDowngrade ? `Switch to ${planType}` : `${planType} – ₱${price}/mo`}
    </Button>
  );
}

function SettingsPageContent() {
  const { getToken } = useAuth();
  const { data: syncData } = useAuthSync();
  const workspace = useWorkspace();
  const flags = useFeatureFlags();
  const [org, setOrg] = useState<Organization | null>(null);
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

  const effectivePlan = simulatedPlan ?? (billing?.planType as PlanType | undefined) ?? "starter";

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

  useEffect(() => {
    if (!syncData) return;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const [orgRes, bizRes, billRes, aiRes, breakdownRes] = await Promise.all([
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
        ]);
        setOrg(orgRes.organization ?? null);
        setAiUsage(aiRes);
        setAiBreakdown(breakdownRes ?? null);
        setOrgName(orgRes.organization?.name ?? "");
        setBusinesses(bizRes.businesses);
        setBilling(billRes);
      } finally {
        setLoading(false);
      }
    })();
  }, [syncData, getToken]);

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

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div>
      <PageHeader
        title="Settings"
        plainLanguageDescription="Manage your organization, businesses, billing, and AI."
        whatThisPageIsFor="Change your workspace name, business details, plan, and AI preferences."
        whatToDoNext="Edit any section below. Changes save when you click Save."
      />

      {feedback && (
        <StatusBanner
          variant={feedback.type}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
          className="mt-4"
        />
      )}

      <section className="mt-8 space-y-4">
        <div>
          <h2 className="text-lg font-medium">Organization</h2>
          <p className="text-sm text-muted-foreground">Your workspace name. This appears in emails and receipts. You can change it anytime.</p>
        </div>
        <form onSubmit={handleSaveOrg} className="flex gap-2">
          <Input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Organization name"
            className="max-w-md"
          />
          <Button type="submit" disabled={savingOrg} className="min-h-[44px]">
            {savingOrg ? "Saving..." : "Save"}
          </Button>
        </form>
      </section>

      <section className="mt-8 space-y-4">
        <div>
          <h2 className="text-lg font-medium">Businesses</h2>
          <p className="text-sm text-muted-foreground">Each business has its own customers and appointments. Edit names or switch CRM mode here.</p>
        </div>
        <ul className="divide-y divide-border">
          {businesses.map((b) => (
            <li key={b.id} className="flex items-center justify-between py-3 first:pt-0">
              {editingBiz === b.id ? (
                <div className="flex gap-2">
                  <Input
                    value={editBizName}
                    onChange={(e) => setEditBizName(e.target.value)}
                    placeholder="Business name"
                    className="w-64"
                  />
                  <Button size="sm" onClick={() => handleSaveBiz(b.id)}>
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingBiz(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="font-medium">{b.name}</span>
                      <span className="ml-2 text-sm text-muted-foreground capitalize">
                        {b.businessType}
                      </span>
                    </div>
                    {(effectivePlan === "growth" || effectivePlan === "ai_pro") &&
                      flags.crm_mode_toggle_enabled && (
                        <select
                          value={b.crmMode ?? "lite"}
                          onChange={(e) =>
                            handleCrmModeChange(b.id, e.target.value as "lite" | "full")
                          }
                          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                        >
                          <option value="lite">CRM Lite</option>
                          <option value="full">CRM Full</option>
                        </select>
                      )}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { setEditingBiz(b.id); setEditBizName(b.name); }}>
                    Edit
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
        {businesses.length === 0 && (
          <p className="text-muted-foreground">No businesses yet. Create one in Setup.</p>
        )}
      </section>

      {billing?.readOnly && (
        <div className="mt-6 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
          <p className="text-base font-medium text-foreground">
            Read-only mode — Your subscription needs attention. Update billing to make changes.
          </p>
        </div>
      )}

      {aiUsage && (
        <section className="mt-8 space-y-4">
          <div>
            <h2 className="text-lg font-medium">AI Usage & Quotas</h2>
            <p className="text-sm text-muted-foreground">AI helps you write messages and summaries. Turn it on to get better promos and faster workflows.</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 max-w-lg">
            <p className="text-sm text-muted-foreground">Plan: {aiUsage.plan}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tokens: {aiUsage.tokensUsed.toLocaleString()} / {aiUsage.tokensLimit > 0 ? aiUsage.tokensLimit.toLocaleString() : "0"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Requests: {aiUsage.requestsUsed} / {aiUsage.requestsLimit}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Quota resets: {aiUsage.resetDate}
            </p>
            {aiUsage.projectedDaysToLimit != null && aiUsage.projectedDaysToLimit > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                Projected days to limit: ~{aiUsage.projectedDaysToLimit} (at current pace)
              </p>
            )}
            {aiUsage.allowedFeatures.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Allowed features: {aiUsage.allowedFeatures.join(", ")}
              </p>
            )}
            {aiBreakdown?.items && aiBreakdown.items.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-foreground">Top features this month</p>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {aiBreakdown.items.slice(0, 5).map((i) => (
                    <li key={i.key}>{i.key}: {i.tokens.toLocaleString()} tokens, {i.requests} requests</li>
                  ))}
                </ul>
              </div>
            )}
            {aiUsage.tokensLimit === 0 && (
              <p className="mt-2 text-sm text-amber-600">
                Upgrade to Growth or AI Pro for AI features.
              </p>
            )}
            {aiUsage.tokensLimit > 0 && (aiUsage.tokensUsed / aiUsage.tokensLimit) >= 0.7 && effectivePlan !== "ai_pro" && (
              <p className="mt-2 text-sm text-amber-600">
                Approaching limit. Consider upgrading for higher allowance.
              </p>
            )}
            {aiUsage.tokensLimit > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">AI enabled</label>
                  <input
                    type="checkbox"
                    checked={aiUsage.aiEnabled}
                    disabled={aiPoliciesLoading}
                    onChange={async (e) => {
                      setAiPoliciesLoading(true);
                      try {
                        const token = await getToken();
                        if (!token) return;
                        await apiRequest("/ai/usage/policies", {
                          method: "PATCH",
                          token,
                          body: JSON.stringify({ aiEnabled: e.target.checked }),
                        });
                        setAiUsage((p) => p ? { ...p, aiEnabled: e.target.checked } : null);
                        setFeedback({ type: "success", message: "AI settings updated." });
                        setTimeout(() => setFeedback(null), 4000);
                      } catch (err) {
                        setFeedback({ type: "error", message: fromError(err, "Failed to update AI settings. Please try again.") });
                      } finally {
                        setAiPoliciesLoading(false);
                      }
                    }}
                    className="rounded"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Soft cap (%):</label>
                  <Input
                    type="number"
                    min={50}
                    max={100}
                    defaultValue={aiUsage.softCapPct ?? 90}
                    disabled={aiPoliciesLoading}
                    className="w-20"
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
                  <span className="text-xs text-muted-foreground">(warn at this %)</span>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="mt-8 space-y-4">
        <div>
          <h2 className="text-lg font-medium">Billing</h2>
          <p className="text-sm text-muted-foreground">Upgrade or switch plans. You can change or cancel anytime. No lock-in.</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 max-w-md">
          <p className="text-sm text-muted-foreground">Plan</p>
          <p className="mt-1 font-medium capitalize">
            {effectivePlan}
            {simulatedPlan && (
              <span className="ml-2 text-xs text-amber-600">(simulated)</span>
            )}
          </p>
          <p className="text-sm text-muted-foreground">Status: {billing?.status ?? "none"}</p>
          {billing?.subscription?.currentPeriodEnd && (
            <p className="mt-1 text-sm text-muted-foreground">
              Current period ends: {new Date(billing.subscription.currentPeriodEnd).toLocaleDateString()}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {(["starter", "growth", "ai_pro"] as const).map((plan) => (
              <UpgradeButton
                key={plan}
                planType={plan}
                currentPlan={effectivePlan}
                getToken={getToken}
                onSuccess={refetchBilling}
                onError={(msg) => {
                  setFeedback({ type: "error", message: msg });
                  setTimeout(() => setFeedback(null), 6000);
                }}
                readOnly={billing?.readOnly}
              />
            ))}
          </div>
        </div>
      </section>

      {isDevMode && (
        <section className="mt-8 space-y-4">
          <h2 className="text-lg font-medium">Dev Tools</h2>
          <div className="rounded-lg border border-amber-500/50 bg-amber-500/5 p-4 max-w-2xl space-y-6">
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
        </section>
      )}
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
  return <SettingsPageContent />;
}
