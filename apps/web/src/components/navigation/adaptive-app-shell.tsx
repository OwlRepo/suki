"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ChevronsLeft, ChevronsRight, Menu } from "lucide-react";
import { AuthButton } from "@/components/auth-button";
import { WorkspaceDropdown } from "@/components/workspace-dropdown";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/contexts/workspace-context";
import { DashboardOnboardingWrapper } from "@/components/onboarding";
import { TrialBanner } from "@/components/trial-banner";
import { usePlanCapabilities } from "@/hooks/use-plan-capabilities";
import {
  getDashboardNavGroups,
  getMobileBottomNavItems,
} from "./dashboard-nav-config";
import { DesktopSidebarNav } from "./desktop-sidebar-nav";
import { MobileBottomNav, BOTTOM_NAV_HEIGHT } from "./mobile-bottom-nav";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import { cn } from "@/lib/utils";
import { TyveraAssistant } from "@/components/tyvera-assistant";
import { getOpenManualFollowUpCount } from "@/components/needs-attention/manual-follow-up.api";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "tyvera-sidebar-collapsed-v1";
const SIDEBAR_COLLAPSED_WIDTH = 72;
const SIDEBAR_EXPANDED_WIDTH = 240;

export function AdaptiveAppShell({ children }: { children: React.ReactNode }) {
  const workspace = useWorkspace();
  const planCapabilities = usePlanCapabilities();
  const activeBiz = workspace?.businesses.find(
    (b) => b.id === workspace?.activeBusinessId
  );
  const showPipeline = activeBiz?.crmMode === "full";
  const [needsAttentionCount, setNeedsAttentionCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getOpenManualFollowUpCount()
      .then((result) => {
        if (!cancelled) setNeedsAttentionCount(result.count);
      })
      .catch(() => {
        if (!cancelled) setNeedsAttentionCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const navGroups = useMemo(
    () =>
      getDashboardNavGroups(
        showPipeline,
        {
          canSeeAiAnalytics: planCapabilities.canSeeAiAnalytics,
        },
        needsAttentionCount,
      ),
    [needsAttentionCount, planCapabilities.canSeeAiAnalytics, showPipeline]
  );
  const mobileBottomItems = useMemo(
    () => getMobileBottomNavItems(showPipeline),
    [showPipeline]
  );

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [sidebarPreferenceReady, setSidebarPreferenceReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    if (raw === "0") setSidebarCollapsed(false);
    if (raw === "1") setSidebarCollapsed(true);
    setSidebarPreferenceReady(true);
  }, []);

  useEffect(() => {
    if (!sidebarPreferenceReady || typeof window === "undefined") return;
    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      sidebarCollapsed ? "1" : "0",
    );
  }, [sidebarCollapsed, sidebarPreferenceReady]);

  return (
    <DashboardOnboardingWrapper>
      <div className="min-h-screen bg-background">
        {/* Desktop: sidebar + main */}
        <div className="flex min-h-screen">
          <aside
            className={cn(
              "hidden border-r border-border bg-card transition-[width] duration-200 ease-out lg:flex lg:flex-col lg:shrink-0"
            )}
            style={{
              width: sidebarCollapsed
                ? SIDEBAR_COLLAPSED_WIDTH
                : SIDEBAR_EXPANDED_WIDTH,
            }}
            aria-label="Sidebar"
          >
            <div
              className={cn(
                "flex h-14 shrink-0 items-center border-b border-border",
                sidebarCollapsed ? "justify-between gap-1 px-1" : "relative px-4"
              )}
            >
              <Link
                href="/dashboard"
                className={cn(
                  "transition-[padding,opacity] duration-150",
                  sidebarCollapsed
                    ? "inline-flex size-8 items-center justify-center rounded-lg border border-border/70 bg-background text-xs font-semibold text-foreground shadow-sm"
                    : "pr-12 text-lg font-semibold text-foreground"
                )}
                aria-label="Tyvera dashboard home"
                title="Tyvera"
              >
                {sidebarCollapsed ? "T" : "Tyvera"}
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={cn(
                  "rounded-xl text-muted-foreground",
                  sidebarCollapsed
                    ? "size-7 min-h-7 min-w-7 shrink-0 rounded-lg p-0"
                    : "absolute right-2 top-1/2 -translate-y-1/2"
                )}
                onClick={() => setSidebarCollapsed((current) => !current)}
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-pressed={!sidebarCollapsed}
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {sidebarCollapsed ? (
                  <ChevronsRight className="size-3.5" aria-hidden />
                ) : (
                  <ChevronsLeft className="size-4" aria-hidden />
                )}
              </Button>
            </div>
            <DesktopSidebarNav
              groups={navGroups}
              className="flex-1"
              collapsed={sidebarCollapsed}
            />
            <div className="w-full border-t border-border p-3">
              <div
                className={cn(
                  "w-full",
                  sidebarCollapsed
                    ? "[&_button]:px-0 [&_button]:justify-center [&_button>span:last-child]:hidden"
                    : "[&_button]:w-full [&_button]:max-w-full [&_button]:justify-start"
                )}
              >
                <WorkspaceDropdown />
              </div>
            </div>
          </aside>

          {/* Mobile: top bar with menu + auth */}
          <div className="flex flex-1 flex-col lg:min-w-0">
            <header className="flex min-h-[56px] shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-4 lg:px-6">
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
                  Tyvera
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
        {planCapabilities.canSeeAssistant ? (
          <TyveraAssistant />
        ) : null}
      </div>
    </DashboardOnboardingWrapper>
  );
}
