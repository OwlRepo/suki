"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavGroup } from "./dashboard-nav-config";

const NAV_LINK_CLASS =
  "flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-colors";

interface DesktopSidebarNavProps {
  groups: NavGroup[];
  className?: string;
}

export function DesktopSidebarNav({ groups, className }: DesktopSidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn("flex flex-col gap-6 px-3 py-4", className)}
      aria-label="Main navigation"
    >
      {groups.map((group) => (
        <div key={group.key}>
          <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {group.label}
          </p>
          <ul className="space-y-1">
            {group.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      NAV_LINK_CLASS,
                      isActive
                        ? "bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden />
                    {item.label}
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
