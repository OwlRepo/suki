"use client";

import { useMemo } from "react";
import { AuthButton } from "@/components/auth-button";
import { DashboardOnboardingWrapper, NavLinkWithLock } from "@/components/onboarding";
import { PipelineNavLink } from "@/components/pipeline-nav-link";
import { WorkspaceDropdown } from "@/components/workspace-dropdown";
import { NavGroupDropdown } from "@/components/nav-group-dropdown";
import { useWorkspace } from "@/contexts/workspace-context";
import { ONBOARDING_STEPS } from "@/lib/onboarding";
import Link from "next/link";

export function DashboardNav({ children }: { children: React.ReactNode }) {
  const workspace = useWorkspace();
  const activeBiz = workspace?.businesses.find(
    (b) => b.id === workspace?.activeBusinessId
  );
  const showPipeline = activeBiz?.crmMode === "full";

  const dailyWorkItems = useMemo(
    () =>
      [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/customers", label: "Customers" },
        { href: "/appointments", label: "Appointments" },
        ...(showPipeline
          ? [
              {
                href: "/pipeline",
                label: "Pipeline",
                kind: "custom" as const,
                element: <PipelineNavLink>Pipeline</PipelineNavLink>,
              },
            ]
          : []),
      ],
    [showPipeline]
  );

  const growthItems = [
    {
      href: "/promos",
      label: "Promos",
      kind: "custom" as const,
      element: (
        <NavLinkWithLock
          href="/promos"
          unlockAfterStep={ONBOARDING_STEPS.appointmentsOverview}
          lockMessage="Unlocks after you add your first appointment."
        >
          Promos
        </NavLinkWithLock>
      ),
    },
    {
      href: "/insights",
      label: "Business Summary",
      kind: "custom" as const,
      element: (
        <NavLinkWithLock
          href="/insights"
          unlockAfterStep={ONBOARDING_STEPS.importCustomers}
          lockMessage="Unlocks after you have a week of data."
        >
          Business Summary
        </NavLinkWithLock>
      ),
    },
    {
      href: "/loyalty",
      label: "Loyalty",
      kind: "custom" as const,
      element: (
        <NavLinkWithLock
          href="/loyalty"
          unlockAfterStep={ONBOARDING_STEPS.promos}
          lockMessage="Unlocks after you create your first promo."
        >
          Loyalty
        </NavLinkWithLock>
      ),
    },
  ];

  const adminItems = [
    {
      href: "/imports",
      label: "Import",
      kind: "custom" as const,
      element: (
        <NavLinkWithLock
          href="/imports"
          unlockAfterStep={ONBOARDING_STEPS.loyalty}
          lockMessage="Unlocks after you enable loyalty."
        >
          Import
        </NavLinkWithLock>
      ),
    },
    { href: "/setup", label: "Setup" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <DashboardOnboardingWrapper>
      <div className="min-h-screen bg-background">
        <header className="overflow-visible border-b border-border bg-card">
          <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 shrink-0 items-center gap-3">
              <Link href="/dashboard" className="shrink-0 text-lg font-semibold text-foreground">
                Suki
              </Link>
            </div>
            <div className="flex shrink-0 items-center gap-1 overflow-visible">
              <NavGroupDropdown label="Daily work" items={dailyWorkItems} />
              <NavGroupDropdown label="Growth" items={growthItems} />
              <NavGroupDropdown label="Admin" items={adminItems} />
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <WorkspaceDropdown />
              <AuthButton />
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </DashboardOnboardingWrapper>
  );
}
