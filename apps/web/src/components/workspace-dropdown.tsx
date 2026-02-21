"use client";

import { useRef, useEffect, useState } from "react";
import { ChevronDown, Building2 } from "lucide-react";
import { useWorkspace } from "@/contexts/workspace-context";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function WorkspaceDropdown() {
  const workspace = useWorkspace();
  const flags = useFeatureFlags();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [open]);

  if (!flags.workspace_global_enabled) return null;
  if (!workspace) return null;
  if (workspace.loading) return null;
  if (workspace.error) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-2 py-1.5">
        <span className="text-sm text-destructive">{workspace.error}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => workspace.refetch()}
          className="h-7 border-destructive/50 text-destructive hover:bg-destructive/20"
        >
          Retry
        </Button>
      </div>
    );
  }
  if (workspace.businesses.length <= 1) return null;

  const activeBiz = workspace.businesses.find(
    (b) => b.id === workspace.activeBusinessId
  );
  const displayName = activeBiz?.name ?? "Select business";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[36px] items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Switch workspace"
      >
        <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="max-w-[140px] truncate">{displayName}</span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-md border border-border bg-popover py-1 shadow-lg">
          <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Business
          </div>
          {workspace.businesses.map((b) => {
            const isActive = b.id === workspace.activeBusinessId;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  workspace.setActiveBusinessId(b.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Building2 className="size-4 shrink-0 opacity-70" aria-hidden />
                <span className="truncate">{b.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
