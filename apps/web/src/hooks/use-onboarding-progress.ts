"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiRequest } from "@/lib/api";
import { ONBOARDING_STEPS } from "@/lib/onboarding";

/** Sentinel step meaning onboarding is complete; user never sees wizard again */
export const ONBOARDING_COMPLETE_STEP = 9;

export interface OnboardingProgress {
  currentStep: number;
  completedSteps: string[];
  timeToFirstValueAt: string | null;
}

export function useOnboardingProgress() {
  const { getToken } = useAuth();
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProgress = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setProgress(null);
        return;
      }
      const data = await apiRequest<OnboardingProgress>("/onboarding/progress", {
        token,
      });
      setProgress({
        currentStep: data.currentStep ?? 0,
        completedSteps: data.completedSteps ?? [],
        timeToFirstValueAt: data.timeToFirstValueAt ?? null,
      });
    } catch {
      setProgress(null);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const updateProgress = useCallback(
    async (updates: {
      currentStep?: number;
      completedSteps?: string[];
      timeToFirstValueAt?: string | null;
    }) => {
      const token = await getToken();
      if (!token) return;
      const data = await apiRequest<OnboardingProgress>("/onboarding/progress", {
        method: "PATCH",
        token,
        body: JSON.stringify(updates),
      });
      setProgress({
        currentStep: data.currentStep ?? 0,
        completedSteps: data.completedSteps ?? [],
        timeToFirstValueAt: data.timeToFirstValueAt ?? null,
      });
      return data;
    },
    [getToken],
  );

  const advanceStep = useCallback(
    async (toStep?: number) => {
      if (!progress) return;
      const next = toStep ?? Math.min(progress.currentStep + 1, ONBOARDING_COMPLETE_STEP);
      const stepId = `step_${next}`;
      const completedSteps = [...new Set([...progress.completedSteps, stepId])];
      await updateProgress({
        currentStep: next,
        completedSteps,
      });
    },
    [progress, updateProgress],
  );

  const markComplete = useCallback(async () => {
    await updateProgress({
      currentStep: ONBOARDING_COMPLETE_STEP,
      completedSteps: [...new Set([...(progress?.completedSteps ?? []), "complete"])],
      timeToFirstValueAt: progress?.timeToFirstValueAt ?? new Date().toISOString(),
    });
  }, [progress, updateProgress]);

  const isComplete =
    progress != null && progress.currentStep >= ONBOARDING_COMPLETE_STEP;

  const currentStep = progress?.currentStep ?? 0;

  return {
    progress,
    loading,
    isComplete,
    currentStep,
    fetchProgress,
    updateProgress,
    advanceStep,
    markComplete,
  };
}

/** Steps 1-8 map to onboarding steps; 9 = complete */
export const WIZARD_STEPS = [
  { id: 1, key: "businessSetup" as const },
  { id: 2, key: "firstDashboard" as const },
  { id: 3, key: "customersPage" as const },
  { id: 4, key: "recordVisit" as const },
  { id: 5, key: "appointmentsOverview" as const },
  { id: 6, key: "promos" as const },
  { id: 7, key: "loyalty" as const },
  { id: 8, key: "importCustomers" as const },
] as const;

export const FINAL_WIZARD_STEP = 8;
