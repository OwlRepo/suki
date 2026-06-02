"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { AuthButton } from "@/components/auth-button";
import { WorkspaceProvider } from "@/contexts/workspace-context";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { RequireSession } from "@/components/require-session";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <RequireSession>
      <OnboardingLayoutContent>{children}</OnboardingLayoutContent>
    </RequireSession>
  );
}

function OnboardingLayoutContent({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  const { data: syncData, loading: syncLoading, error: syncError, retry: retrySync } = useAuthSync();
  const organizationId = syncData?.organization?.id ?? null;

  if (syncLoading || !organizationId) {
    if (syncError && !syncLoading) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
          <p className="text-base text-muted-foreground">
            Something went wrong while loading your account.
          </p>
          <button
            type="button"
            onClick={retrySync}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-base text-muted-foreground">Preparing your setup…</p>
      </div>
    );
  }

  return (
    <WorkspaceProvider getToken={getToken} enabled={!!organizationId}>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div>
              <Link
                href="/onboarding"
                className="text-lg font-semibold text-foreground"
              >
                Tyvera
              </Link>
              <p className="text-xs text-muted-foreground">
                Your progress is saved. You can finish anytime.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Finish later
              </Link>
              <AuthButton />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    </WorkspaceProvider>
  );
}
