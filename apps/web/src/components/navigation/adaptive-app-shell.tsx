"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { AuthButton } from "@/components/auth-button";
import { WorkspaceDropdown } from "@/components/workspace-dropdown";
import { useWorkspace } from "@/contexts/workspace-context";
import { DashboardOnboardingWrapper } from "@/components/onboarding";
import { TrialBanner } from "@/components/trial-banner";
import {
  getDashboardNavGroups,
  getMobileBottomNavItems,
} from "./dashboard-nav-config";
import { DesktopSidebarNav } from "./desktop-sidebar-nav";
import { MobileBottomNav, BOTTOM_NAV_HEIGHT } from "./mobile-bottom-nav";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import { cn } from "@/lib/utils";

const SIDEBAR_WIDTH = 240;

export function AdaptiveAppShell({ children }: { children: React.ReactNode }) {
  const workspace = useWorkspace();
  const activeBiz = workspace?.businesses.find(
    (b) => b.id === workspace?.activeBusinessId
  );
  const showPipeline = activeBiz?.crmMode === "full";

  const navGroups = useMemo(
    () => getDashboardNavGroups(showPipeline),
    [showPipeline]
  );
  const mobileBottomItems = useMemo(
    () => getMobileBottomNavItems(showPipeline),
    [showPipeline]
  );

  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <DashboardOnboardingWrapper>
      <div className="min-h-screen bg-background">
        {/* Desktop: sidebar + main */}
        <div className="flex min-h-screen">
          <aside
            className={cn(
              "hidden border-r border-border bg-card lg:flex lg:flex-col lg:shrink-0"
            )}
            style={{ width: SIDEBAR_WIDTH }}
            aria-label="Sidebar"
          >
            <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
              <Link
                href="/dashboard"
                className="text-lg font-semibold text-foreground"
              >
                Suki
              </Link>
            </div>
            <DesktopSidebarNav groups={navGroups} className="flex-1" />
            <div className="w-full border-t border-border p-3">
              <div className="w-full [&_button]:w-full [&_button]:max-w-full [&_button]:justify-start">
                <WorkspaceDropdown />
              </div>
            </div>
          </aside>

          {/* Mobile: top bar with menu + auth */}
          <div className="flex flex-1 flex-col lg:min-w-0">
            <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-4 lg:px-6">
              <div className="flex min-w-0 shrink-0 items-center gap-3 lg:hidden">
                <button
                  type="button"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  onClick={() => setDrawerOpen(true)}
                  aria-label="Open menu"
                >
                  <Menu className="size-6" aria-hidden />
                </button>
                <Link
                  href="/dashboard"
                  className="text-lg font-semibold text-foreground"
                >
                  Suki
                </Link>
              </div>
              <div className="hidden lg:flex lg:flex-1" aria-hidden />
              <div className="flex shrink-0 items-center gap-2 lg:gap-3">
                <div className="hidden lg:block">
                  <WorkspaceDropdown />
                </div>
                <AuthButton />
              </div>
            </header>

            <main
              className={cn(
                "flex-1 px-4 py-7 sm:px-6 lg:px-8",
                "pb-[calc(env(safe-area-inset-bottom)+",
                BOTTOM_NAV_HEIGHT,
                "px)] lg:pb-6"
              )}
            >
              <TrialBanner />
              {children}
            </main>

            {/* Mobile bottom nav */}
            <MobileBottomNav
              items={mobileBottomItems}
              onOpenMenu={() => setDrawerOpen(true)}
            />
          </div>
        </div>

        {/* Mobile drawer - opened from header or bottom nav */}
        <MobileNavDrawer
          groups={navGroups}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
        />
      </div>
    </DashboardOnboardingWrapper>
  );
}
