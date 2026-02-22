"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface NavItemBase {
  href: string;
  label: string;
}

interface NavItemSimple extends NavItemBase {
  kind?: "simple";
}

interface NavItemCustom extends NavItemBase {
  kind: "custom";
  element: React.ReactElement;
}

type NavItem = NavItemSimple | NavItemCustom;

interface NavGroupDropdownProps {
  label: string;
  items: NavItem[];
  className?: string;
}

const CLOSE_DELAY_MS = 120;

export function NavGroupDropdown({ label, items, className }: NavGroupDropdownProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleClose = () => {
    closeTimeoutRef.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  const cancelClose = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const handleEnter = () => {
    cancelClose();
    setOpen(true);
  };

  const handleLeave = () => {
    scheduleClose();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div
        className={cn("relative", className)}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex min-h-[36px] items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            aria-expanded={open}
            aria-haspopup="true"
          >
            {label}
            <ChevronDown className="size-4 shrink-0 opacity-70" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto min-w-[160px] p-1"
          sideOffset={4}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          {items.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
            const linkClass = cn(
              "block w-full rounded-sm px-3 py-2 text-left text-sm transition-colors no-underline",
              isActive
                ? "bg-primary/10 font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            );
            const content =
              item.kind === "custom" ? (
                <span className="block w-full [&_a]:block [&_a]:w-full [&_a]:text-inherit [&_a]:no-underline">
                  {item.element}
                </span>
              ) : (
                <Link href={item.href} className="block w-full text-inherit no-underline">
                  {item.label}
                </Link>
              );
            return (
              <div key={item.href} className={linkClass}>
                {content}
              </div>
            );
          })}
        </PopoverContent>
      </div>
    </Popover>
  );
}
