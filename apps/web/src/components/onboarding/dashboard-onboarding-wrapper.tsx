"use client";

import { ReactNode } from "react";
import { OnboardingProvider } from "@/contexts/onboarding-context";
import { useAuthSync } from "@/hooks/use-auth-sync";

export function DashboardOnboardingWrapper({ children }: { children: ReactNode }) {
  const { data: syncData } = useAuthSync();
  const organizationId = syncData?.organization?.id ?? null;
  return (
    <OnboardingProvider organizationId={organizationId}>
      {children}
    </OnboardingProvider>
  );
}
