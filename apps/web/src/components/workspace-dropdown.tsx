"use client";

import { ChevronDown, Building2 } from "lucide-react";
import { useWorkspace } from "@/contexts/workspace-context";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function WorkspaceDropdown() {
  const workspace = useWorkspace();
  const flags = useFeatureFlags();

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex min-h-[36px] items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
          aria-label="Switch workspace"
        >
          <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="max-w-[140px] truncate">{displayName}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px]">
        <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Business
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspace.businesses.map((b) => {
          const isActive = b.id === workspace.activeBusinessId;
          return (
            <DropdownMenuItem
              key={b.id}
              onClick={() => workspace.setActiveBusinessId(b.id)}
              className={cn(
                isActive && "bg-primary/10 font-medium text-foreground"
              )}
            >
              <Building2 className="size-4 shrink-0 opacity-70" aria-hidden />
              <span className="truncate">{b.name}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
