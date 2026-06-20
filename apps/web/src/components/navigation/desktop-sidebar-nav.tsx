"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavGroup } from "./dashboard-nav-config";

const NAV_LINK_CLASS =
  "relative flex min-h-[46px] items-center rounded-xl text-base font-medium transition-[background-color,color,opacity,padding] duration-150";

interface DesktopSidebarNavProps {
  groups: NavGroup[];
  className?: string;
  collapsed?: boolean;
}

export function DesktopSidebarNav({
  groups,
  className,
  collapsed = false,
}: DesktopSidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "flex flex-col py-4",
        collapsed ? "gap-4 px-2" : "gap-6 px-3",
        className
      )}
      aria-label="Main navigation"
    >
      {groups.map((group) => (
        <div key={group.key}>
          <p
            className={cn(
              "text-xs font-medium uppercase tracking-wider text-muted-foreground",
              collapsed ? "sr-only" : "mb-2 px-3"
            )}
          >
            {group.label}
          </p>
          <ul className={cn(collapsed ? "space-y-2" : "space-y-1")}>
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
                      collapsed
                        ? "min-h-[48px] justify-center rounded-2xl px-0 py-0"
                        : "gap-3 px-3 py-2.5",
                      isActive
                        ? "bg-primary/10 text-foreground ring-1 ring-primary/20"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    aria-label={item.label}
                    aria-current={isActive ? "page" : undefined}
                    title={item.label}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden />
                    {collapsed ? null : <span className="truncate">{item.label}</span>}
                    {item.badgeCount && item.badgeCount > 0 ? (
                      <span
                        className={cn(
                          "rounded-full bg-destructive font-semibold text-destructive-foreground",
                          collapsed
                            ? "absolute right-1.5 top-1.5 min-w-5 px-1.5 py-0.5 text-[10px] leading-none"
                            : "ml-auto px-2 py-0.5 text-xs"
                        )}
                      >
                        {item.badgeCount > 99 ? "99+" : item.badgeCount}
                      </span>
                    ) : null}
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
