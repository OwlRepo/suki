"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { WorkspaceDropdown } from "@/components/workspace-dropdown";
import { cn } from "@/lib/utils";
import type { NavGroup } from "./dashboard-nav-config";

const DRAWER_LINK_CLASS =
  "relative flex min-h-[124px] flex-col items-center justify-center gap-3 rounded-2xl border px-4 py-5 text-center text-sm font-medium transition-[background-color,color,box-shadow] duration-150";

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
      <SheetContent
        side="left"
        className="w-dvw max-w-none gap-0 p-0 sm:w-[min(30rem,100dvw)] sm:max-w-[30rem]"
      >
        <SheetHeader className="border-b border-border px-5 py-5">
          <SheetTitle className="text-xl">Menu</SheetTitle>
          <SheetDescription className="sr-only">
            Browse dashboard destinations and switch workspaces.
          </SheetDescription>
        </SheetHeader>
        <nav
          className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-5"
          aria-label="Full navigation"
        >
          {groups.map((group) => (
            <div key={group.key}>
              <p className="mb-3 px-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {group.label}
              </p>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                            ? "border-primary/20 bg-primary/10 text-foreground shadow-[0_12px_30px_rgba(15,23,42,0.08)] ring-1 ring-primary/15"
                            : "border-border/70 bg-background text-muted-foreground shadow-[0_8px_24px_rgba(15,23,42,0.06)] hover:bg-muted/30 hover:text-foreground"
                        )}
                      >
                        <Icon className="size-6 shrink-0" aria-hidden />
                        <span className="text-sm font-medium leading-tight text-balance">
                          {item.label}
                        </span>
                        {item.badgeCount && item.badgeCount > 0 ? (
                          <span className="absolute right-2.5 top-2.5 min-w-5 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold leading-none text-destructive-foreground">
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
        <SheetFooter className="mt-auto border-t border-border bg-background/95 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
          <div className="w-full [&_button]:w-full [&_button]:justify-start">
            <WorkspaceDropdown />
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
