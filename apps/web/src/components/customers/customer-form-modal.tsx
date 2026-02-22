"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CustomerFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; mobile?: string; tags?: string }) => void;
  loading?: boolean;
}

/**
 * Modal for adding a customer. Required: Name + Mobile.
 * Optional fields (labels) are hidden behind "More options".
 */
export function CustomerFormModal({
  open,
  onClose,
  onSubmit,
  loading = false,
}: CustomerFormModalProps) {
  const [name, setName] = React.useState("");
  const [mobile, setMobile] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [showMore, setShowMore] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (!open) {
      setName("");
      setMobile("");
      setTags("");
      setShowMore(false);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !mobile.trim()) return;
    onSubmit({
      name: name.trim(),
      mobile: mobile.trim(),
      tags: showMore ? (tags.trim() || undefined) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle id="customer-form-title">Add customer</DialogTitle>
          <DialogDescription>
            Add people here and track their visits. You can edit details anytime.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="customer-name" className="mb-1 block text-sm font-medium">
              Name <span className="text-destructive">(Required)</span>
            </label>
            <Input
              id="customer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Juan Dela Cruz"
              required
              className="w-full"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="customer-mobile" className="mb-1 block text-sm font-medium">
              Mobile <span className="text-destructive">(Required)</span>
            </label>
            <Input
              id="customer-mobile"
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="e.g. 09XX XXX XXXX"
              className="w-full"
              required
            />
          </div>
          {showMore ? (
            <div>
              <label htmlFor="customer-tags" className="mb-1 block text-sm font-medium">
                Labels <span className="text-muted-foreground">(Optional)</span>
              </label>
              <Input
                id="customer-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. VIP, Regular"
                className="w-full"
              />
              <button
                type="button"
                onClick={() => setShowMore(false)}
                className="mt-1 text-sm text-muted-foreground hover:text-foreground"
              >
                Hide optional fields
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowMore(true)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              More options (Optional)
            </button>
          )}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={loading || !name.trim() || !mobile.trim()} className="min-h-[44px]">
              {loading ? "Saving…" : "Save customer"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
