"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBanner } from "@/components/ui/status-banner";
import { useWorkspace } from "@/contexts/workspace-context";
import { ONBOARDING_COMPLETE_STEP, useOnboardingProgress } from "@/hooks/use-onboarding-progress";
import { OnboardingSetupStep } from "./onboarding-setup-step";

export function OnboardingWizard() {
  const { replace } = useRouter();
  const workspace = useWorkspace();
  const { progress, loading, error: progressError, isComplete, updateProgress, fetchProgress } = useOnboardingProgress();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const attemptedBusiness = useRef<string | null>(null);
  const businessId = workspace?.businesses[0]?.id ?? null;

  const finishSetup = useCallback(async () => {
    if (savingRef.current || !progress) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      // Completing business setup is not a first customer visit or booking event.
      await updateProgress({
        currentStep: ONBOARDING_COMPLETE_STEP,
        completedSteps: [...new Set([...progress.completedSteps, "complete"])],
      });
      replace("/dashboard?welcome=1");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save setup. Please retry.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [progress, replace, updateProgress]);

  useEffect(() => {
    if (isComplete) replace("/dashboard?welcome=1");
  }, [isComplete, replace]);

  useEffect(() => {
    if (loading || isComplete || !progress || !businessId || attemptedBusiness.current === businessId) return;
    attemptedBusiness.current = businessId;
    void finishSetup();
  }, [businessId, finishSetup, isComplete, loading, progress]);

  if (loading || workspace?.loading) {
    return <p className="py-12 text-muted-foreground" role="status">Loading your business setup…</p>;
  }

  if (progressError || !progress) {
    return <div className="space-y-4"><StatusBanner variant="error" message={progressError?.message ?? "Could not load setup progress."} /><Button onClick={() => void fetchProgress()}>Retry</Button></div>;
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader title="Set up your business" description="Add your business name and type to start using Suki. You can book appointments and share your link whenever you are ready." />
      <Card className="p-5 sm:p-6">
        {businessId ? <p className="text-muted-foreground" role="status">{saving ? "Opening your workspace…" : "Your business is ready."}</p> : <OnboardingSetupStep onComplete={() => void finishSetup()} onBusinessCreated={() => void finishSetup()} />}
      </Card>
      {error && <div className="space-y-3"><p className="text-destructive" role="alert">{error}</p><Button onClick={() => void finishSetup()} disabled={saving}>Retry</Button></div>}
      <p className="text-sm text-muted-foreground">No sample customers, visits, or appointments required.</p>
    </div>
  );
}
