"use client";

import { useWorkspace } from "@/contexts/workspace-context";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      <Label htmlFor="workspace-select" className="sr-only">
        Active workspace
      </Label>
      <Select
        value={workspace.activeBusinessId ?? workspace.businesses[0]?.id ?? ""}
        onValueChange={(v) => workspace.setActiveBusinessId(v)}
      >
        <SelectTrigger id="workspace-select" className="h-8 px-2 py-1.5 text-sm">
          <SelectValue placeholder="Select workspace" />
        </SelectTrigger>
        <SelectContent>
          {workspace.businesses.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
