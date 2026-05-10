"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";

/** Sentinel step meaning onboarding is complete; user never sees wizard again */
export const ONBOARDING_COMPLETE_STEP = 7;

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

  const goToStep = useCallback(
    async (step: number) => {
      if (!progress) return;
      const bounded = Math.max(1, Math.min(step, FINAL_WIZARD_STEP));
      if (bounded > progress.currentStep) {
        const stepId = `step_${bounded}`;
        const completedSteps = [...new Set([...progress.completedSteps, stepId])];
        await updateProgress({ currentStep: bounded, completedSteps });
      } else {
        await updateProgress({ currentStep: bounded });
      }
    },
    [progress, updateProgress],
  );

  const goBackStep = useCallback(
    async (current: number) => {
      if (!progress || current <= 1) return;
      const prev = Math.max(1, current - 1);
      await updateProgress({ currentStep: prev });
    },
    [progress, updateProgress],
  );

  const skipToNext = useCallback(
    async (current: number) => {
      if (!progress) return;
      const next = Math.min(current + 1, FINAL_WIZARD_STEP);
      await advanceStep(next);
    },
    [progress, advanceStep],
  );

  const getProgressPercent = useCallback((step: number) => {
    if (step >= ONBOARDING_COMPLETE_STEP) return 100;
    return Math.round((Math.max(0, Math.min(step, FINAL_WIZARD_STEP)) / FINAL_WIZARD_STEP) * 100);
  }, []);

  return {
    progress,
    loading,
    isComplete,
    currentStep,
    fetchProgress,
    updateProgress,
    advanceStep,
    markComplete,
    goToStep,
    goBackStep,
    skipToNext,
    getProgressPercent,
  };
}

/** Steps 1-6 map to onboarding steps; 7 = complete */
export const WIZARD_STEPS = [
  { id: 1, key: "businessSetup" as const },
  { id: 2, key: "firstDashboard" as const },
  { id: 3, key: "customersPage" as const },
  { id: 4, key: "recordVisit" as const },
  { id: 5, key: "appointmentsOverview" as const },
  { id: 6, key: "importCustomers" as const },
] as const;

export const FINAL_WIZARD_STEP = 6;
