"use client";

import React, { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleClose = () => {
    closeTimeoutRef.current = setTimeout(() => setIsOpen(false), CLOSE_DELAY_MS);
  };

  const cancelClose = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const handleEnter = () => {
    cancelClose();
    setIsOpen(true);
  };

  const handleLeave = () => {
    scheduleClose();
  };

  useEffect(() => () => cancelClose(), []);

  const updatePosition = () => {
    const el = triggerRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      setPosition({ top: rect.bottom + 4, left: rect.left });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [isOpen]);

  return (
    <div
      className={cn("relative", className)}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        ref={triggerRef}
        type="button"
        className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 min-h-[36px] transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {label}
        <ChevronDown className="size-4 shrink-0 opacity-70" aria-hidden />
      </button>
      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[9999] min-w-[160px] rounded-md border border-border bg-popover py-1 shadow-lg"
            style={{ top: position.top, left: position.left }}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
          >
            {items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
              const linkClass = cn(
                "block w-full px-3 py-2 text-left text-sm transition-colors rounded-sm mx-1 no-underline",
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
          </div>,
          document.body
        )}
    </div>
  );
}
