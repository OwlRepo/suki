"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboardingProgress, ONBOARDING_COMPLETE_STEP } from "@/hooks/use-onboarding-progress";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { Button } from "@/components/ui/button";
import { StatusBanner } from "@/components/ui/status-banner";

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { replace } = useRouter();
  const { progress, loading, isComplete, updateProgress, fetchProgress, error: progressError } = useOnboardingProgress();
  const workspace = useWorkspace();
  const { data: syncData, loading: syncLoading, error: syncError, retry: retrySync } = useAuthSync();
  const [completionError, setCompletionError] = useState<string | null>(null);
  const attempted = useRef<string | null>(null);
  const organizationId = syncData?.organization?.id ?? null;
  const hasBusiness = (workspace?.businesses.length ?? 0) > 0;

  const finishSetup = useCallback(async () => {
    if (!progress) return;
    await updateProgress({ currentStep: ONBOARDING_COMPLETE_STEP, completedSteps: [...new Set([...progress.completedSteps, "complete"])] });
  }, [progress, updateProgress]);

  const retryCompletion = () => {
    void finishSetup().then(() => setCompletionError(null), (cause: unknown) => {
      setCompletionError(cause instanceof Error ? cause.message : "Could not save setup progress.");
    });
  };

  useEffect(() => {
    if (syncLoading || !organizationId || loading || workspace?.loading || isComplete) return;
    if (!hasBusiness) {
      if (!workspace?.error) replace("/onboarding");
      return;
    }
    if (progress && attempted.current !== organizationId) {
      attempted.current = organizationId;
      void finishSetup().then(() => setCompletionError(null), (cause: unknown) => {
        setCompletionError(cause instanceof Error ? cause.message : "Could not save setup progress.");
      });
    }
  }, [finishSetup, hasBusiness, isComplete, loading, organizationId, progress, replace, syncLoading, workspace?.error, workspace?.loading]);

  if (syncError || workspace?.error || progressError) {
    return <div className="space-y-4"><StatusBanner variant="error" message={syncError || workspace?.error || progressError?.message || "Could not load your workspace."} /><Button onClick={() => { if (syncError) retrySync(); else if (workspace?.error) void workspace.refetch(); else void fetchProgress(); }}>Retry</Button></div>;
  }

  if (syncLoading || !organizationId || loading || workspace?.loading) {
    return <p className="py-12 text-muted-foreground" role="status">Preparing your workspace…</p>;
  }

  if (!hasBusiness && !isComplete) return null;

  return <>{completionError && <StatusBanner variant="error" message={<span>{completionError} <Button size="sm" variant="outline" onClick={retryCompletion}>Retry</Button></span>} />}{children}</>;
}
