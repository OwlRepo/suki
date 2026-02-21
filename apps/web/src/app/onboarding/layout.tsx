"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { AuthButton } from "@/components/auth-button";
import { WorkspaceProvider } from "@/contexts/workspace-context";
import { useAuthSync } from "@/hooks/use-auth-sync";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  const { data: syncData } = useAuthSync();
  const organizationId = syncData?.organization?.id ?? null;

  return (
    <WorkspaceProvider getToken={getToken} enabled={!!organizationId}>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link
              href="/onboarding"
              className="text-lg font-semibold text-foreground"
            >
              Suki
            </Link>
            <AuthButton />
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    </WorkspaceProvider>
  );
}
