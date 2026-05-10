"use client";

import { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { WorkspaceProvider } from "@/contexts/workspace-context";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { OnboardingGate } from "./onboarding-gate";

export function DashboardOnboardingWrapper({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  const { data: syncData } = useAuthSync();
  const organizationId = syncData?.organization?.id ?? null;

  return (
    <WorkspaceProvider getToken={getToken} enabled={!!organizationId}>
      <OnboardingGate>{children}</OnboardingGate>
    </WorkspaceProvider>
  );
}
