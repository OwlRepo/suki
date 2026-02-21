"use client";

import { ReactNode } from "react";
import { useAuth } from "@clerk/nextjs";
import { OnboardingProvider } from "@/contexts/onboarding-context";
import { WorkspaceProvider } from "@/contexts/workspace-context";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { OnboardingGate } from "./onboarding-gate";

export function DashboardOnboardingWrapper({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  const { data: syncData } = useAuthSync();
  const flags = useFeatureFlags();
  const organizationId = syncData?.organization?.id ?? null;

  const content = (
    <WorkspaceProvider getToken={getToken} enabled={!!organizationId}>
      <OnboardingGate>{children}</OnboardingGate>
    </WorkspaceProvider>
  );

  if (flags.onboarding_v2_enabled) {
    return (
      <OnboardingProvider organizationId={organizationId}>
        {content}
      </OnboardingProvider>
    );
  }
  return content;
}
