"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { WorkspaceDropdown } from "@/components/workspace-dropdown";
import { cn } from "@/lib/utils";
import type { NavGroup } from "./dashboard-nav-config";

const DRAWER_LINK_CLASS =
  "flex min-h-[44px] items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors";

interface MobileNavDrawerProps {
  groups: NavGroup[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNavDrawer({
  groups,
  open,
  onOpenChange,
}: MobileNavDrawerProps) {
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] sm:max-w-[280px]">
        <SheetHeader>
          <SheetTitle className="text-lg">Menu</SheetTitle>
        </SheetHeader>
        <nav className="mt-6 flex flex-col gap-6" aria-label="Full navigation">
          {groups.map((group) => (
            <div key={group.key}>
              <p className="mb-2 px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" &&
                      pathname.startsWith(item.href + "/"));
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => onOpenChange(false)}
                        className={cn(
                          DRAWER_LINK_CLASS,
                          isActive
                            ? "bg-primary/10 text-foreground"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        )}
                      >
                        <Icon className="size-5 shrink-0" aria-hidden />
                        <span className="truncate">{item.label}</span>
                        {item.badgeCount && item.badgeCount > 0 ? (
                          <span className="ml-auto rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground">
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
        <SheetFooter className="mt-auto border-t border-border p-4">
          <WorkspaceDropdown />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
