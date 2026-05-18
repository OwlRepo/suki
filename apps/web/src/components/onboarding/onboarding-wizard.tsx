"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateTimePicker } from "@/components/ui/date-pickers";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { useOnboardingProgress, FINAL_WIZARD_STEP } from "@/hooks/use-onboarding-progress";
import { useWorkspace } from "@/contexts/workspace-context";
import { getStepGuidance } from "@/lib/onboarding";
import { OnboardingDashboardPreviewStep } from "./onboarding-dashboard-preview-step";
import { OnboardingJourneyProgress } from "./onboarding-journey-progress";
import { OnboardingSetupStep } from "./onboarding-setup-step";
import { OnboardingStepIntro } from "./onboarding-step-intro";

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
    goBackStep,
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
  const [importNotes, setImportNotes] = useState("");
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);

  useEffect(() => {
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
    await advanceStep(2);
  }, [advanceStep]);

  const handleContinue = async () => {
    if (step < FINAL_WIZARD_STEP) {
      await nextStep(step + 1);
    } else {
      await markComplete();
      router.replace("/dashboard?welcome=1");
    }
  };

  const handleGoBack = useCallback(async () => {
    await goBackStep(step);
    setError(null);
  }, [goBackStep, step]);

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
      setSuccessFeedback(guidance.successFeedback);
      setTimeout(() => {
        setSuccessFeedback(null);
        nextStep(4);
      }, 1200);
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
      setSuccessFeedback(guidance.successFeedback);
      setTimeout(() => {
        setSuccessFeedback(null);
        nextStep(5);
      }, 1200);
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
      setSuccessFeedback(guidance.successFeedback);
      setTimeout(() => {
        setSuccessFeedback(null);
        nextStep(6);
      }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create appointment.");
    } finally {
      setBusy(false);
    }
  };

  if (loading || isComplete) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <p className="text-base text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <OnboardingJourneyProgress currentStep={step} />

      {step === 1 && (
        <>
          <OnboardingStepIntro guidance={guidance} />
          <OnboardingSetupStep
            onComplete={handleContinue}
            onBusinessCreated={handleBusinessCreated}
          />
        </>
      )}

      {step === 2 && (
        <>
          <OnboardingStepIntro guidance={guidance} />
          <OnboardingDashboardPreviewStep
            onContinue={handleContinue}
            onContinueSecondary={handleContinue}
            disabled={busy}
          />
          {guidance.allowSkip && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => nextStep(3)}
            >
              Skip this step
            </Button>
          )}
        </>
      )}

      {step >= 3 && (
        <Card className="space-y-6 rounded-lg p-6">
          <CardContent className="space-y-6 p-0">
          <OnboardingStepIntro guidance={guidance} />

          {successFeedback && (
            <div className="rounded-md border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm text-green-700" role="status">
              {successFeedback}
            </div>
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
                {busy ? "Saving…" : guidance.primaryActionLabel}
              </Button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              {!hasCustomers ? (
                <p className="text-sm text-muted-foreground">Add a customer in Step 3 first.</p>
              ) : (
                <>
                  <Select
                    value={selectedVisitCustomerId}
                    onValueChange={(v) => setSelectedCustomerId(v)}
                  >
                    <SelectTrigger className="min-h-[44px] w-full text-base">
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} — {c.visitCount} visit{c.visitCount !== 1 ? "s" : ""} recorded
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="lg" className="min-h-[44px] text-base" onClick={handleRecordVisit} disabled={busy}>
                    {busy ? "Recording…" : guidance.primaryActionLabel}
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
                  <Select
                    value={selectedAppointmentCustomerId}
                    onValueChange={(v) => setAppointmentCustomerId(v)}
                  >
                    <SelectTrigger className="min-h-[44px] w-full text-base">
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <DateTimePicker value={appointmentWhen} onChange={setAppointmentWhen} aria-label="Onboarding appointment date and time" />
                  <Button size="lg" className="min-h-[44px] text-base" onClick={handleCreateAppointment} disabled={busy}>
                    {busy ? "Saving…" : guidance.primaryActionLabel}
                  </Button>
                </>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <Textarea
                value={importNotes}
                onChange={(e) => setImportNotes(e.target.value)}
                placeholder="Optional: paste customer names or notes for later import. You can do this later from the Customers page."
                className="min-h-[120px] w-full text-base"
              />
              <div className="flex flex-wrap gap-3">
                <Button size="lg" className="min-h-[44px] text-base" onClick={handleContinue} disabled={busy}>
                  {guidance.primaryActionLabel}
                </Button>
                <Button variant="outline" size="lg" className="min-h-[44px] text-base" onClick={handleContinue} disabled={busy}>
                  {guidance.secondaryActionLabel}
                </Button>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      )}

      {(step >= 2 || (step === 1 && businesses.length >= 1)) && (
        <div className="flex flex-wrap items-center gap-3">
          {step >= 2 && step <= FINAL_WIZARD_STEP && (
            <Button
              variant="outline"
              size="lg"
              className="min-h-[44px] text-base"
              onClick={handleGoBack}
              disabled={busy}
            >
              <ChevronLeft className="mr-1 size-4" aria-hidden />
              Back
            </Button>
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
      )}
    </div>
  );
}
