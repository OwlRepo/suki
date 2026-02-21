"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@suki/ui";
import { useAuth } from "@clerk/nextjs";
import { apiRequest } from "@/lib/api";
import { useOnboardingProgress, FINAL_WIZARD_STEP } from "@/hooks/use-onboarding-progress";
import { useWorkspace } from "@/contexts/workspace-context";
import { getStepGuidance } from "@/lib/onboarding";
import { OnboardingSetupStep } from "./onboarding-setup-step";

type StepCustomer = {
  id: string;
  name: string;
  visitCount: number;
};

export function OnboardingWizard() {
  const router = useRouter();
  const { getToken } = useAuth();
  const workspace = useWorkspace();
  const {
    progress,
    loading: progressLoading,
    isComplete,
    currentStep,
    advanceStep,
    markComplete,
  } = useOnboardingProgress();
  const businesses = workspace?.businesses ?? [];
  const loading = progressLoading;
  const [customers, setCustomers] = useState<StepCustomer[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [appointmentCustomerId, setAppointmentCustomerId] = useState("");
  const [appointmentWhen, setAppointmentWhen] = useState("");
  const [promoType, setPromoType] = useState("discount");
  const [promoValue, setPromoValue] = useState("10% off");
  const [promoMessage, setPromoMessage] = useState("Thank you for visiting. Enjoy 10% off on your next visit.");
  const [loyaltyThreshold, setLoyaltyThreshold] = useState(5);
  const [importNotes, setImportNotes] = useState("");

  useEffect(() => {
    // #region agent log
    fetch("http://127.0.0.1:7247/ingest/fff4b1e3-aab4-44a4-abd8-c773446f506f",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"b61998"},body:JSON.stringify({sessionId:"b61998",runId:"run1",hypothesisId:"H1",location:"onboarding-wizard.tsx:isCompleteEffect",message:"isComplete effect evaluated",data:{isComplete,currentStep,progressStep:progress?.currentStep ?? null,businessesCount:businesses.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (isComplete) {
      router.replace("/dashboard?welcome=1");
    }
  }, [isComplete, router, currentStep, progress?.currentStep, businesses.length]);

  const step = Math.max(1, Math.min(currentStep, FINAL_WIZARD_STEP));
  const activeBiz = workspace?.businesses.find(
    (b) => b.id === workspace?.activeBusinessId
  ) ?? workspace?.businesses[0];
  const activeBusinessId = activeBiz?.id ?? "";
  const businessType = activeBiz?.businessType;
  const guidance = getStepGuidance(step, businessType);

  const loadCustomers = useCallback(async () => {
    if (!activeBusinessId) return;
    const token = await getToken();
    if (!token) return;
    const res = await apiRequest<{ customers: StepCustomer[] }>(
      `/customers?businessId=${encodeURIComponent(activeBusinessId)}&limit=50`,
      { token }
    );
    setCustomers(res.customers ?? []);
  }, [activeBusinessId, getToken]);

  useEffect(() => {
    if (activeBusinessId && step >= 4) {
      loadCustomers().catch(() => {});
    }
  }, [activeBusinessId, step, loadCustomers]);

  const hasCustomers = customers.length > 0;
  const selectedVisitCustomerId = selectedCustomerId || customers[0]?.id || "";
  const selectedAppointmentCustomerId = appointmentCustomerId || customers[0]?.id || "";

  const nextStep = useCallback(
    async (next: number) => {
      await advanceStep(next);
      setError(null);
    },
    [advanceStep]
  );

  const handleBusinessCreated = useCallback(async () => {
    // #region agent log
    fetch("http://127.0.0.1:7247/ingest/fff4b1e3-aab4-44a4-abd8-c773446f506f",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"b61998"},body:JSON.stringify({sessionId:"b61998",runId:"run1",hypothesisId:"H3",location:"onboarding-wizard.tsx:handleBusinessCreated:beforeAdvance",message:"business created callback invoked",data:{currentStep,progressStep:progress?.currentStep ?? null,completedStepsCount:progress?.completedSteps?.length ?? null,businessesCount:businesses.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    await advanceStep(2);
    // #region agent log
    fetch("http://127.0.0.1:7247/ingest/fff4b1e3-aab4-44a4-abd8-c773446f506f",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"b61998"},body:JSON.stringify({sessionId:"b61998",runId:"run1",hypothesisId:"H3",location:"onboarding-wizard.tsx:handleBusinessCreated:afterAdvance",message:"business created callback finished advanceStep(2)",data:{currentStep,progressStep:progress?.currentStep ?? null,completedStepsCount:progress?.completedSteps?.length ?? null,businessesCount:businesses.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [advanceStep, businesses.length, currentStep, progress?.completedSteps?.length, progress?.currentStep]);

  const handleContinue = async () => {
    if (step < FINAL_WIZARD_STEP) {
      await nextStep(step + 1);
    } else {
      await markComplete();
      router.replace("/dashboard?welcome=1");
    }
  };

  const handleCreateCustomer = async () => {
    if (!activeBusinessId || !customerName.trim()) {
      setError("Please enter at least the customer's name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const res = await apiRequest<{ customer: StepCustomer }>("/customers", {
        method: "POST",
        token,
        body: JSON.stringify({
          businessId: activeBusinessId,
          name: customerName.trim(),
          mobile: customerMobile.trim() || undefined,
        }),
      });
      const created = res.customer;
      setCustomers((prev) => [created, ...prev]);
      setSelectedCustomerId(created.id);
      setAppointmentCustomerId(created.id);
      await nextStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add customer.");
    } finally {
      setBusy(false);
    }
  };

  const handleRecordVisit = async () => {
    if (!selectedVisitCustomerId) {
      setError("Please select a customer first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      await apiRequest(`/customers/${selectedVisitCustomerId}/visit`, {
        method: "POST",
        token,
      });
      await loadCustomers();
      await nextStep(5);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record visit.");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateAppointment = async () => {
    if (!activeBusinessId || !selectedAppointmentCustomerId || !appointmentWhen) {
      setError("Please select a customer and appointment date/time.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      await apiRequest("/appointments", {
        method: "POST",
        token,
        body: JSON.stringify({
          businessId: activeBusinessId,
          customerId: selectedAppointmentCustomerId,
          scheduledAt: new Date(appointmentWhen).toISOString(),
          notes: "Created from onboarding",
        }),
      });
      await nextStep(6);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create appointment.");
    } finally {
      setBusy(false);
    }
  };

  const handleCreatePromo = async () => {
    if (!activeBusinessId || !promoType) {
      setError("Please complete promo details.");
      return;
    }
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 14);
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      await apiRequest("/promos", {
        method: "POST",
        token,
        body: JSON.stringify({
          businessId: activeBusinessId,
          type: promoType,
          value: promoValue || undefined,
          validityStart: now.toISOString(),
          validityEnd: end.toISOString(),
          messageContent: promoMessage,
        }),
      });
      await nextStep(7);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create promo.");
    } finally {
      setBusy(false);
    }
  };

  const handleLoyaltyContinue = async () => {
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (token && activeBusinessId) {
        await apiRequest(
          `/loyalty/status?businessId=${encodeURIComponent(activeBusinessId)}&threshold=${encodeURIComponent(String(loyaltyThreshold))}`,
          { token }
        );
      }
      await nextStep(8);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to validate loyalty step.");
    } finally {
      setBusy(false);
    }
  };

  const stepTitle = useMemo(
    () =>
      step === 1
        ? "Set up your business"
        : step === 2
          ? "Your daily dashboard workflow"
          : step === 3
            ? "Add your first customer"
            : step === 4
              ? "Record a visit"
              : step === 5
                ? "Add an appointment"
                : step === 6
                  ? "Create a promo"
                  : step === 7
                    ? "Set your loyalty rule"
                    : "Finalize onboarding",
    [step]
  );

  if (loading || isComplete) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <p className="text-base text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Step {step} of {FINAL_WIZARD_STEP}
        </p>
        <h1 className="text-2xl font-semibold text-foreground">{stepTitle}</h1>
        <p className="mt-2 text-base text-muted-foreground">
          {guidance?.message}
        </p>
      </div>

      {step === 1 ? (
        <OnboardingSetupStep
          onComplete={handleContinue}
          onBusinessCreated={handleBusinessCreated}
        />
      ) : (
        <div className="space-y-6 rounded-lg border border-border bg-card p-6">
          <p className="text-base text-foreground">
            {guidance?.expectedAction}
          </p>
          {step === 2 && (
            <Button size="lg" className="min-h-[44px] text-base" onClick={handleContinue}>
              Continue
            </Button>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer name (required)"
                className="min-h-[44px] text-base"
              />
              <Input
                value={customerMobile}
                onChange={(e) => setCustomerMobile(e.target.value)}
                placeholder="Mobile number (optional)"
                className="min-h-[44px] text-base"
              />
              <Button size="lg" className="min-h-[44px] text-base" onClick={handleCreateCustomer} disabled={busy}>
                {busy ? "Saving…" : "Save customer and continue"}
              </Button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              {!hasCustomers ? (
                <p className="text-sm text-muted-foreground">Add a customer in Step 3 first.</p>
              ) : (
                <>
                  <select
                    value={selectedVisitCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-base"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (visits: {c.visitCount})
                      </option>
                    ))}
                  </select>
                  <Button size="lg" className="min-h-[44px] text-base" onClick={handleRecordVisit} disabled={busy}>
                    {busy ? "Recording…" : "Record visit and continue"}
                  </Button>
                </>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              {!hasCustomers ? (
                <p className="text-sm text-muted-foreground">Add a customer first before creating an appointment.</p>
              ) : (
                <>
                  <select
                    value={selectedAppointmentCustomerId}
                    onChange={(e) => setAppointmentCustomerId(e.target.value)}
                    className="min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-base"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="datetime-local"
                    value={appointmentWhen}
                    onChange={(e) => setAppointmentWhen(e.target.value)}
                    className="min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-base"
                  />
                  <Button size="lg" className="min-h-[44px] text-base" onClick={handleCreateAppointment} disabled={busy}>
                    {busy ? "Saving…" : "Create appointment and continue"}
                  </Button>
                </>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <select
                value={promoType}
                onChange={(e) => setPromoType(e.target.value)}
                className="min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-base"
              >
                <option value="discount">Discount</option>
                <option value="free_addon">Free add-on</option>
                <option value="loyalty">Loyalty</option>
                <option value="reminder">Reminder</option>
                <option value="other">Other</option>
              </select>
              <Input
                value={promoValue}
                onChange={(e) => setPromoValue(e.target.value)}
                placeholder="Promo value (e.g. 10% off)"
                className="min-h-[44px] text-base"
              />
              <textarea
                value={promoMessage}
                onChange={(e) => setPromoMessage(e.target.value)}
                placeholder="Promo message"
                className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-base"
              />
              <Button size="lg" className="min-h-[44px] text-base" onClick={handleCreatePromo} disabled={busy}>
                {busy ? "Saving…" : "Create promo and continue"}
              </Button>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-foreground">
                Loyalty threshold (visits)
              </label>
              <input
                type="number"
                min={1}
                value={loyaltyThreshold}
                onChange={(e) => setLoyaltyThreshold(Number(e.target.value || 1))}
                className="min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-base"
              />
              <p className="text-sm text-muted-foreground">
                Suggested rule: {loyaltyThreshold} visits before reward unlock.
              </p>
              <Button size="lg" className="min-h-[44px] text-base" onClick={handleLoyaltyContinue} disabled={busy}>
                {busy ? "Saving…" : "Save loyalty step and continue"}
              </Button>
            </div>
          )}

          {step === 8 && (
            <div className="space-y-4">
              <textarea
                value={importNotes}
                onChange={(e) => setImportNotes(e.target.value)}
                placeholder="Optional: paste customer names or notes for later import."
                className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-base"
              />
              <div className="flex flex-wrap gap-3">
                <Button size="lg" className="min-h-[44px] text-base" onClick={handleContinue} disabled={busy}>
                  Finish onboarding
                </Button>
                <Button variant="outline" size="lg" className="min-h-[44px] text-base" onClick={handleContinue} disabled={busy}>
                  Skip import and finish
                </Button>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}

      {step === 1 && businesses.length >= 1 && (
        <Button
          size="lg"
          className="min-h-[44px] w-full text-base sm:w-auto"
          onClick={handleContinue}
        >
          Continue to next step
        </Button>
      )}
    </div>
  );
}
