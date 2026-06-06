"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { AuthButton } from "@/components/auth-button";
import { cn } from "@/lib/utils";
import { getPlatformAdminNavGroups } from "./platform-admin-nav-config";

const SIDEBAR_WIDTH = 240;
const NAV_LINK_CLASS =
  "flex min-h-[46px] items-center gap-3 rounded-xl px-3 py-2.5 text-base font-medium transition-colors";

export function PlatformAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navGroups = useMemo(() => getPlatformAdminNavGroups(), []);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        <aside
          className="hidden border-r border-border bg-card lg:flex lg:shrink-0 lg:flex-col"
          style={{ width: SIDEBAR_WIDTH }}
          aria-label="Platform admin sidebar"
        >
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
            <Link
              href="/platform-admin"
              className="text-lg font-semibold text-foreground"
            >
              Tyvera Internal
            </Link>
          </div>
          <PlatformAdminNav pathname={pathname} navGroups={navGroups} />
        </aside>

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
                href="/platform-admin"
                className="text-lg font-semibold text-foreground"
              >
                Tyvera Internal
              </Link>
            </div>
            <div className="hidden lg:flex lg:flex-1" aria-hidden />
            <AuthButton />
          </header>

          <main className="flex-1 px-4 py-7 sm:px-6 lg:px-8 lg:pb-6">
            {children}
          </main>
        </div>
      </div>

      {drawerOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/40 lg:hidden"
          role="presentation"
          onClick={() => setDrawerOpen(false)}
        >
          <aside
            className="h-full w-[280px] bg-background p-4 shadow-xl"
            aria-label="Platform admin mobile navigation"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex min-h-[44px] items-center justify-between">
              <p className="text-lg font-semibold text-foreground">Menu</p>
              <button
                type="button"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setDrawerOpen(false)}
              >
                Close
              </button>
            </div>
            <PlatformAdminNav
              pathname={pathname}
              navGroups={navGroups}
              onNavigate={() => setDrawerOpen(false)}
            />
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function PlatformAdminNav({
  pathname,
  navGroups,
  onNavigate,
}: {
  pathname: string;
  navGroups: ReturnType<typeof getPlatformAdminNavGroups>;
  onNavigate?: () => void;
}) {
  return (
    <nav
      className="flex flex-1 flex-col gap-6 px-3 py-4"
      aria-label="Platform admin navigation"
    >
      {navGroups.map((group) => (
        <div key={group.key}>
          <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {group.label}
          </p>
          <ul className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      NAV_LINK_CLASS,
                      isActive
                        ? "bg-primary/10 text-foreground ring-1 ring-primary/20"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
