"use client";

import { useWorkspace } from "@/contexts/workspace-context";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { Button } from "@/components/ui/button";

export function WorkspaceSelector() {
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
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="workspace-select" className="sr-only">
        Active workspace
      </label>
      <select
        id="workspace-select"
        value={workspace.activeBusinessId ?? ""}
        onChange={(e) => workspace.setActiveBusinessId(e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
      >
        {workspace.businesses.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </div>
  );
}
