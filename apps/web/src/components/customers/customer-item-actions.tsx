"use client";

import * as React from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmActionInline } from "@/components/ui/confirm-action-inline";

interface CustomerItemActionsProps {
  onRecordVisit: () => void;
  onRemove: () => void;
  onViewMessages?: () => void;
}

/**
 * One primary action (Record visit) plus Remove in a 3-dot menu.
 */
export function CustomerItemActions({
  onRecordVisit,
  onRemove,
  onViewMessages,
}: CustomerItemActionsProps) {
  const [confirmingRemove, setConfirmingRemove] = React.useState(false);

  if (confirmingRemove) {
    return (
      <ConfirmActionInline
        confirmMessage="Remove this customer? This cannot be undone."
        confirmLabel="Yes, remove"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => {
          onRemove();
          setConfirmingRemove(false);
        }}
        onCancel={() => setConfirmingRemove(false)}
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={onRecordVisit}>
        Record visit
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="More actions"
            aria-haspopup="true"
          >
            <MoreHorizontal className="size-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onViewMessages && (
            <DropdownMenuItem onClick={onViewMessages}>
              Message history
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmingRemove(true)}
          >
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
