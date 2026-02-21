"use client";

import * as React from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsSectionCardProps {
  id: string;
  title: string;
  description: string;
  defaultOpen?: boolean;
  collapsedByDefault?: boolean;
  children: React.ReactNode;
  className?: string;
  /** Used for search filtering - if false, section is hidden */
  visible?: boolean;
}

export function SettingsSectionCard({
  id,
  title,
  description,
  defaultOpen = true,
  collapsedByDefault = false,
  children,
  className,
  visible = true,
}: SettingsSectionCardProps) {
  const [open, setOpen] = React.useState(
    collapsedByDefault ? false : defaultOpen
  );

  if (!visible) return null;

  return (
    <section
      id={id}
      className={cn(
        "rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md",
        className
      )}
      data-settings-section={id}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full min-h-[52px] items-center justify-between gap-4 px-5 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-t-xl"
        aria-expanded={open}
        aria-controls={`${id}-content`}
        id={`${id}-header`}
      >
        <div className="flex flex-col items-start gap-0.5">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <span className="shrink-0 text-muted-foreground" aria-hidden>
          {open ? (
            <ChevronDownIcon className="size-5" />
          ) : (
            <ChevronRightIcon className="size-5" />
          )}
        </span>
      </button>
      <div
        id={`${id}-content`}
        role="region"
        aria-labelledby={`${id}-header`}
        className={cn(
          "border-t border-border transition-all",
          open ? "block" : "hidden"
        )}
      >
        <div className="p-5">{children}</div>
      </div>
    </section>
  );
}
