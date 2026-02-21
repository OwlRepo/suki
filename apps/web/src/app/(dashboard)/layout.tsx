import { ReactNode } from "react";
import Link from "next/link";
import { AuthButton } from "@/components/auth-button";
import { DashboardOnboardingWrapper, NavLinkWithLock } from "@/components/onboarding";
import { PipelineNavLink } from "@/components/pipeline-nav-link";
import { WorkspaceSelector } from "@/components/workspace-selector";
import { ONBOARDING_STEPS } from "@/lib/onboarding";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardOnboardingWrapper>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-lg font-semibold text-foreground">
                Suki
              </Link>
              <WorkspaceSelector />
            </div>
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
                Dashboard
              </Link>
              <Link href="/customers" className="text-sm text-muted-foreground hover:text-foreground">
                Customers
              </Link>
              <Link href="/appointments" className="text-sm text-muted-foreground hover:text-foreground">
                Appointments
              </Link>
              <PipelineNavLink className="text-sm text-muted-foreground hover:text-foreground">
                Pipeline
              </PipelineNavLink>
              <NavLinkWithLock
                href="/promos"
                className="text-sm text-muted-foreground hover:text-foreground"
                unlockAfterStep={ONBOARDING_STEPS.appointmentsOverview}
                lockMessage="Unlocks after you add your first appointment."
              >
                Promos
              </NavLinkWithLock>
              <NavLinkWithLock
                href="/insights"
                className="text-sm text-muted-foreground hover:text-foreground"
                unlockAfterStep={ONBOARDING_STEPS.importCustomers}
                lockMessage="Unlocks after you have a week of data."
              >
                Business Summary
              </NavLinkWithLock>
              <NavLinkWithLock
                href="/loyalty"
                className="text-sm text-muted-foreground hover:text-foreground"
                unlockAfterStep={ONBOARDING_STEPS.promos}
                lockMessage="Unlocks after you create your first promo."
              >
                Loyalty
              </NavLinkWithLock>
              <NavLinkWithLock
                href="/imports"
                className="text-sm text-muted-foreground hover:text-foreground"
                unlockAfterStep={ONBOARDING_STEPS.loyalty}
                lockMessage="Unlocks after you enable loyalty."
              >
                Import
              </NavLinkWithLock>
              <Link href="/setup" className="text-sm text-muted-foreground hover:text-foreground">
                Setup
              </Link>
              <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground">
                Settings
              </Link>
              <AuthButton />
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </DashboardOnboardingWrapper>
  );
}
