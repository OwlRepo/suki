"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ConfirmActionInline } from "@/components/ui/confirm-action-inline";
import { cn } from "@/lib/utils";

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
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [confirmingRemove, setConfirmingRemove] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [menuOpen]);

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
    <div className="relative flex items-center gap-2" ref={menuRef}>
      <Button size="sm" onClick={onRecordVisit}>
        Record visit
      </Button>
      <div className="relative">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="More actions"
          aria-expanded={menuOpen}
          aria-haspopup="true"
        >
          <span className="text-muted-foreground">⋯</span>
        </Button>
        {menuOpen && (
          <div
            className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-md border border-border bg-popover py-1 shadow-md"
            role="menu"
          >
            {onViewMessages && (
              <button
                type="button"
                role="menuitem"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  setMenuOpen(false);
                  onViewMessages();
                }}
              >
                Message history
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
              onClick={() => {
                setMenuOpen(false);
                setConfirmingRemove(true);
              }}
            >
              Remove
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
