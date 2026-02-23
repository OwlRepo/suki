"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "./dashboard-nav-config";
import { Button } from "@/components/ui/button";

const BOTTOM_NAV_HEIGHT = 64;

interface MobileBottomNavProps {
  items: NavItem[];
  onOpenMenu: () => void;
  className?: string;
}

export function MobileBottomNav({
  items,
  onOpenMenu,
  className,
}: MobileBottomNavProps) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-card/95 px-2 py-2 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:hidden",
        className
      )}
      style={{ minHeight: BOTTOM_NAV_HEIGHT }}
      role="navigation"
      aria-label="Primary navigation"
    >
      {items.slice(0, 4).map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-2 text-xs font-medium transition-colors",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            <span>{item.label}</span>
          </Link>
        );
      })}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="min-h-[44px] min-w-[44px] shrink-0"
        onClick={onOpenMenu}
        aria-label="Open menu"
      >
        <Menu className="size-5" aria-hidden />
      </Button>
    </div>
  );
}

export { BOTTOM_NAV_HEIGHT };
