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
  onAdjustVisit?: () => void;
  onViewVisitHistory?: () => void;
}

/**
 * One primary action (Record visit) plus dropdown: Correct visit, Message history, Visit history, Remove.
 */
export function CustomerItemActions({
  onRecordVisit,
  onRemove,
  onViewMessages,
  onAdjustVisit,
  onViewVisitHistory,
}: CustomerItemActionsProps) {
  const [confirmingRemove, setConfirmingRemove] = React.useState(false);
  const [confirmingRecordVisit, setConfirmingRecordVisit] = React.useState(false);

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

  if (confirmingRecordVisit) {
    return (
      <ConfirmActionInline
        confirmMessage="Record 1 visit for this customer?"
        confirmLabel="Yes, record"
        cancelLabel="Cancel"
        onConfirm={() => {
          onRecordVisit();
          setConfirmingRecordVisit(false);
        }}
        onCancel={() => setConfirmingRecordVisit(false)}
      />
    );
  }

  return (
    <div className="flex flex-shrink-0 items-center gap-2">
      <Button size="sm" onClick={() => setConfirmingRecordVisit(true)}>
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
          {onAdjustVisit && (
            <DropdownMenuItem onClick={onAdjustVisit}>
              Correct visit count
            </DropdownMenuItem>
          )}
          {onViewVisitHistory && (
            <DropdownMenuItem onClick={onViewVisitHistory}>
              View adjustment history
            </DropdownMenuItem>
          )}
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
