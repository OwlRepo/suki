"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@suki/ui";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { hasClerk } from "@/lib/clerk";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { StatusBanner } from "@/components/ui/status-banner";
import {
  PracticeDayBanner,
  OnboardingGuidance,
  TooltipBadge,
} from "@/components/onboarding";
import { AiQuotaBanner } from "@/components/ai-quota-banner";
import { useOnboarding } from "@/contexts/onboarding-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { ONBOARDING_STEPS, SAMPLE_PROMOS, PRACTICE_SAMPLE_LABEL } from "@/lib/onboarding";
import { recordOnboardingEvent } from "@/lib/onboarding-metrics";

interface Business {
  id: string;
  name: string;
  businessType: string;
}

interface Promo {
  id: string;
  type: string;
  value?: string | null;
  validityStart: string;
  validityEnd: string;
  audienceFilter?: { minVisits?: number; maxInactiveDays?: number } | null;
  messageContent?: string | null;
  status: string;
  createdAt: string;
}

const MESSAGE_TEMPLATES = [
  { id: "we_miss_you", label: "We miss you", message: "Hi! We haven't seen you in a while. Come back and get 20% off your next visit. We'd love to see you again!", value: "20%" },
  { id: "come_back_save", label: "Come back & save", message: "Thanks for being a loyal customer! Here's 15% off your next visit. Show this message when you come in.", value: "15%" },
  { id: "thank_you", label: "Thank you for visiting", message: "Thank you for visiting us today! We hope to see you again soon.", value: "" },
] as const;

const PROMO_TYPES = [
  { value: "discount", label: "Discount" },
  { value: "free_addon", label: "Free add-on" },
  { value: "loyalty", label: "Loyalty" },
  { value: "reminder", label: "Reminder" },
  { value: "other", label: "Other" },
];

function PromosPageContent() {
  const { getToken } = useAuth();
  const { data: syncData } = useAuthSync();
  const onboarding = useOnboarding();
  const workspace = useWorkspace();
  const selectedBiz = workspace?.activeBusinessId ?? "";
  const businesses = workspace?.businesses ?? [];
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    type: "discount",
    value: "",
    validityStart: "",
    validityEnd: "",
    messageContent: "",
    minVisits: "",
    maxInactiveDays: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAiGenerate, setShowAiGenerate] = useState(false);
  const [sendConfirmId, setSendConfirmId] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [planType, setPlanType] = useState<string>("starter");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadPromos = async () => {
    if (!selectedBiz) return;
    const token = await getToken();
    if (!token) return;
    const res = await apiRequest<{ promos: Promo[] }>(`/promos?businessId=${selectedBiz}`, { token });
    setPromos(res.promos);
  };

  useEffect(() => {
    if (!syncData) return;
    setLoading(false);
  }, [syncData]);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const res = await apiRequest<{ planType: string }>("/billing/status", { token });
        setPlanType(res.planType ?? "starter");
      } catch {
        setPlanType("starter");
      }
    })();
  }, [getToken]);

  useEffect(() => {
    if (!selectedBiz) return;
    loadPromos();
  }, [selectedBiz]);

  const resetForm = () => {
    setFormData({
      type: "discount",
      value: "",
      validityStart: "",
      validityEnd: "",
      messageContent: "",
      minVisits: "",
      maxInactiveDays: "",
    });
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const handleEdit = (p: Promo) => {
    setEditingId(p.id);
    setFormData({
      type: p.type,
      value: p.value ?? "",
      validityStart: p.validityStart.slice(0, 16),
      validityEnd: p.validityEnd.slice(0, 16),
      messageContent: p.messageContent ?? "",
      minVisits: p.audienceFilter?.minVisits != null ? String(p.audienceFilter.minVisits) : "",
      maxInactiveDays: p.audienceFilter?.maxInactiveDays != null ? String(p.audienceFilter.maxInactiveDays) : "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBiz || !formData.type) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const start = formData.validityStart || new Date().toISOString().slice(0, 16);
      const end = formData.validityEnd || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
      const audienceFilter =
        formData.minVisits || formData.maxInactiveDays
          ? {
              minVisits: formData.minVisits ? parseInt(formData.minVisits, 10) : undefined,
              maxInactiveDays: formData.maxInactiveDays ? parseInt(formData.maxInactiveDays, 10) : undefined,
            }
          : undefined;

      if (editingId) {
        await apiRequest(`/promos/${editingId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify({
            type: formData.type,
            value: formData.value || undefined,
            validityStart: new Date(start).toISOString(),
            validityEnd: new Date(end).toISOString(),
            audienceFilter,
            messageContent: formData.messageContent || undefined,
          }),
        });
      } else {
        await apiRequest("/promos", {
          method: "POST",
          token,
          body: JSON.stringify({
            businessId: selectedBiz,
            type: formData.type,
            value: formData.value || undefined,
            validityStart: new Date(start).toISOString(),
            validityEnd: new Date(end).toISOString(),
            audienceFilter,
            messageContent: formData.messageContent || undefined,
          }),
        });
      }
      if (!editingId) {
        onboarding?.advanceStep();
        recordOnboardingEvent("promo_created", syncData?.organization?.id ?? null);
      }
      resetForm();
      loadPromos();
      setFeedback({ type: "success", message: editingId ? "Offer updated." : "Offer created." });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || !selectedBiz) return;
    setAiGenerating(true);
    setAiError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiRequest<{ generatedMessage: string }>("/messaging/generate", {
        method: "POST",
        token,
        body: JSON.stringify({
          businessId: selectedBiz,
          prompt: aiPrompt.trim(),
        }),
      });
      setFormData((d) => ({ ...d, messageContent: res.generatedMessage }));
      setShowAiGenerate(false);
      setAiPrompt("");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI generation failed");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSendConfirm = (id: string) => {
    setSendConfirmId(id);
  };

  const handleSend = async (id: string) => {
    try {
      const token = await getToken();
      if (!token) return;
      await apiRequest(`/promos/${id}/send`, { method: "PATCH", token });
      setSendConfirmId(null);
      loadPromos();
      setFeedback({ type: "success", message: "Offer marked as sent." });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Failed to send" });
    }
  };

  const showPracticeData = onboarding?.practiceMode && !onboarding.onboardingCompletedAt;
  const displayPromos = showPracticeData ? SAMPLE_PROMOS : promos;

  if (loading || workspace?.loading) return <p className="text-muted-foreground">Loading...</p>;
  if (!businesses.length && !showPracticeData) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Promos</h1>
        <p className="mt-2 text-muted-foreground">Create a business in Setup first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <PracticeDayBanner />
        <OnboardingGuidance
          step={ONBOARDING_STEPS.promos}
          screen="promos"
          onComplete={() => {}}
        />
      </div>
      <div className="space-y-8">
        <AiQuotaBanner />
        <PageHeader
          title={<TooltipBadge screen="promos">Send Offers to Customers</TooltipBadge>}
          description="Create offers and messages your customers will receive."
          actions={
            <Button onClick={() => { resetForm(); setShowForm(true); }}>
              Create promo
            </Button>
          }
        />

        {feedback && (
          <StatusBanner
            variant={feedback.type}
            message={feedback.message}
            onDismiss={() => setFeedback(null)}
          />
        )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-md border border-border bg-card p-4"
        >
          <h2 className="text-lg font-medium">{editingId ? "Edit promo" : "New promo"}</h2>
          {!editingId && (
            <div>
              <label className="mb-1 block text-sm font-medium">Start from a template</label>
              <div className="flex flex-wrap gap-2">
                {MESSAGE_TEMPLATES.map((t) => (
                  <Button
                    key={t.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFormData((d) => ({
                        ...d,
                        messageContent: t.message,
                        value: t.value,
                        type: t.value ? "discount" : d.type,
                      }));
                    }}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData((d) => ({ ...d, type: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {PROMO_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Value (e.g. 10%)</label>
              <Input
                value={formData.value}
                onChange={(e) => setFormData((d) => ({ ...d, value: e.target.value }))}
                placeholder="10%"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Start</label>
              <Input
                type="datetime-local"
                value={formData.validityStart}
                onChange={(e) => setFormData((d) => ({ ...d, validityStart: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">End</label>
              <Input
                type="datetime-local"
                value={formData.validityEnd}
                onChange={(e) => setFormData((d) => ({ ...d, validityEnd: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Minimum visits (targeting)</label>
              <Input
                type="number"
                min={0}
                value={formData.minVisits}
                onChange={(e) => setFormData((d) => ({ ...d, minVisits: e.target.value }))}
                placeholder="e.g. 5"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Inactive days (targeting)</label>
              <Input
                type="number"
                min={0}
                value={formData.maxInactiveDays}
                onChange={(e) => setFormData((d) => ({ ...d, maxInactiveDays: e.target.value }))}
                placeholder="e.g. 30"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Message</label>
            <textarea
              value={formData.messageContent}
              onChange={(e) => setFormData((d) => ({ ...d, messageContent: e.target.value }))}
              placeholder="e.g. Hi! Come back and get 20% off your next visit."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            {formData.messageContent && (
              <div className="mt-2 rounded-md border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">This is what your customer will receive.</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{formData.messageContent}</p>
              </div>
            )}
            {planType === "ai_pro" ? (
              <div className="mt-2">
                {!showAiGenerate ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAiGenerate(true)}
                  >
                    Generate with AI
                  </Button>
                ) : (
                  <div className="rounded border border-border bg-muted/50 p-2">
                    <Input
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="e.g. Write a promo for 20% off next visit"
                      className="mb-2"
                    />
                    {aiError && <p className="mb-2 text-sm text-destructive">{aiError}</p>}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAiGenerate}
                        disabled={aiGenerating}
                      >
                        {aiGenerating ? "Generating..." : "Generate"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => { setShowAiGenerate(false); setAiError(null); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : onboarding?.practiceMode ? "Practice save" : editingId ? "Update" : "Create"}
          </Button>
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <PageSection>
        <p className="text-sm text-muted-foreground">{displayPromos.length} promo{displayPromos.length !== 1 ? "s" : ""}</p>
        <ul className="mt-4 divide-y divide-border">
          {displayPromos.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 py-5 first:pt-0"
            >
              <div>
                <span className="font-medium capitalize">{p.type.replace("_", " ")}</span>
                {"isPracticeSample" in p && (p as { isPracticeSample?: boolean }).isPracticeSample && (
                  <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                    {PRACTICE_SAMPLE_LABEL}
                  </span>
                )}
                {p.value && <span className="ml-2 text-muted-foreground">{p.value}</span>}
                <span className={`ml-2 rounded px-2 py-0.5 text-xs ${p.status === "sent" ? "bg-muted" : "bg-primary/10"}`}>
                  {p.status}
                </span>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(p.validityStart).toLocaleString()} – {new Date(p.validityEnd).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                {!("isPracticeSample" in p && (p as { isPracticeSample?: boolean }).isPracticeSample) && "createdAt" in p && (
                  <Button size="sm" variant="outline" onClick={() => handleEdit(p as Promo)}>
                    Edit
                  </Button>
                )}
                {p.status === "draft" && !("isPracticeSample" in p && (p as { isPracticeSample?: boolean }).isPracticeSample) && (
                  <>
                    {sendConfirmId === p.id ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          This will be sent to your target customers. Continue?
                        </span>
                        <Button size="sm" onClick={() => handleSend(p.id)}>
                          Yes, send
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setSendConfirmId(null)}>
                          Cancel
                        </Button>
                      </span>
                    ) : (
                      <Button size="sm" onClick={() => handleSendConfirm(p.id)}>
                        Mark as sent
                      </Button>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
        {displayPromos.length === 0 && (
          <p className="py-8 text-center text-helper">No offers yet. Create one to get started — you can turn it on or off anytime.</p>
        )}
      </PageSection>
      </div>
    </div>
  );
}

export default function PromosPage() {
  if (!hasClerk) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Promos</h1>
        <p className="mt-2 text-muted-foreground">
          Clerk authentication is not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to manage promos.
        </p>
      </div>
    );
  }
  return <PromosPageContent />;
}
