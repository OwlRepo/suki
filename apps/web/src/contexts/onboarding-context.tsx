"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ONBOARDING_STEPS,
  CHECKLIST_DAYS,
  type OnboardingStepId,
  type ChecklistItem,
} from "@/lib/onboarding";

const STORAGE_KEY = "suki-onboarding";
const MAX_STEP = 8;

export interface OnboardingState {
  practiceMode: boolean;
  currentStep: OnboardingStepId;
  checklistDay: number;
  checklistCompleted: Record<number, boolean[]>;
  onboardingCompletedAt: string | null;
  startDate: string | null;
}

const defaultState: OnboardingState = {
  practiceMode: true,
  currentStep: 1,
  checklistDay: 1,
  checklistCompleted: {},
  onboardingCompletedAt: null,
  startDate: null,
};

function loadState(organizationId: string): OnboardingState {
  if (typeof window === "undefined") return defaultState;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${organizationId}`);
    if (!raw) return { ...defaultState, startDate: new Date().toISOString().split("T")[0] };
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    return {
      ...defaultState,
      ...parsed,
      checklistCompleted: parsed.checklistCompleted ?? {},
    };
  } catch {
    return defaultState;
  }
}

function saveState(organizationId: string, state: OnboardingState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_KEY}-${organizationId}`, JSON.stringify(state));
  } catch {
    // ignore
  }
}

interface OnboardingContextValue extends OnboardingState {
  organizationId: string | null;
  setPracticeMode: (value: boolean) => void;
  advanceStep: () => void;
  setStep: (step: OnboardingStepId) => void;
  completeChecklistItem: (day: number, itemIndex: number) => void;
  isChecklistItemDone: (day: number, itemIndex: number) => boolean;
  getChecklistForDay: (day: number) => ChecklistItem[];
  finishOnboarding: () => void;
  skipPracticeDays: () => void;
  reinitializePracticeDays: () => void;
  isStepUnlocked: (step: OnboardingStepId) => boolean;
  isFeatureUnlocked: (phase: 1 | 2 | 3, opts?: { visitsCount?: number; hasPromo?: boolean; hasCustomer?: boolean }) => boolean;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({
  children,
  organizationId,
}: {
  children: ReactNode;
  organizationId: string | null;
}) {
  const [state, setState] = useState<OnboardingState>(defaultState);

  useEffect(() => {
    if (organizationId) {
      setState(loadState(organizationId));
    }
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      saveState(organizationId, state);
    }
  }, [organizationId, state]);

  const setPracticeMode = useCallback((value: boolean) => {
    setState((s) => ({ ...s, practiceMode: value }));
  }, []);

  const advanceStep = useCallback(() => {
    setState((s) => ({
      ...s,
      currentStep: Math.min(s.currentStep + 1, MAX_STEP) as OnboardingStepId,
    }));
  }, []);

  const setStep = useCallback((step: OnboardingStepId) => {
    setState((s) => ({ ...s, currentStep: step }));
  }, []);

  const completeChecklistItem = useCallback((day: number, itemIndex: number) => {
    setState((s) => {
      const completed = { ...(s.checklistCompleted[day] ?? []) };
      completed[itemIndex] = true;
      return {
        ...s,
        checklistCompleted: { ...s.checklistCompleted, [day]: completed },
      };
    });
  }, []);

  const isChecklistItemDone = useCallback(
    (day: number, itemIndex: number) => {
      return state.checklistCompleted[day]?.[itemIndex] ?? false;
    },
    [state.checklistCompleted],
  );

  const getChecklistForDay = useCallback(
    (day: number) => {
      return CHECKLIST_DAYS[day] ?? [];
    },
    [],
  );

  const finishOnboarding = useCallback(() => {
    setState((s) => ({
      ...s,
      onboardingCompletedAt: new Date().toISOString(),
    }));
  }, []);

  const skipPracticeDays = useCallback(() => {
    setState((s) => ({
      ...s,
      practiceMode: false,
      onboardingCompletedAt: new Date().toISOString(),
    }));
  }, []);

  const reinitializePracticeDays = useCallback(() => {
    setState({
      ...defaultState,
      practiceMode: true,
      startDate: new Date().toISOString().split("T")[0],
    });
  }, []);

  const isStepUnlocked = useCallback(
    (step: OnboardingStepId): boolean => {
      return state.currentStep >= step;
    },
    [state.currentStep],
  );

  const isFeatureUnlocked = useCallback(
    (
      phase: 1 | 2 | 3,
      opts?: { visitsCount?: number; hasPromo?: boolean; hasCustomer?: boolean },
    ): boolean => {
      if (state.onboardingCompletedAt) return true;
      if (phase === 1) return true;
      if (phase === 2) {
        return (opts?.visitsCount ?? 0) >= 1 || (opts?.hasCustomer ?? false);
      }
      if (phase === 3) {
        return (opts?.visitsCount ?? 0) >= 3 || (opts?.hasPromo ?? false) || (opts?.hasCustomer ?? false);
      }
      return false;
    },
    [state.onboardingCompletedAt],
  );

  const value = useMemo<OnboardingContextValue>(
    () => ({
      ...state,
      organizationId,
      setPracticeMode,
      advanceStep,
      setStep,
      completeChecklistItem,
      isChecklistItemDone,
      getChecklistForDay,
      finishOnboarding,
      skipPracticeDays,
      reinitializePracticeDays,
      isStepUnlocked,
      isFeatureUnlocked,
    }),
    [
      state,
      organizationId,
      setPracticeMode,
      advanceStep,
      setStep,
      completeChecklistItem,
      isChecklistItemDone,
      getChecklistForDay,
      finishOnboarding,
      skipPracticeDays,
      reinitializePracticeDays,
      isStepUnlocked,
      isFeatureUnlocked,
    ],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  return ctx;
}
