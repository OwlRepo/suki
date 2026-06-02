"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/api";
import {
  PH_MOBILE_E164_ERROR,
  PH_MOBILE_E164_PLACEHOLDER,
  normalizePhilippineMobileE164,
} from "@tyvera/types";

interface TemplateField {
  key: string;
  label: string;
  placeholder?: string;
}

interface CustomerTemplate {
  id: string;
  name: string;
  fieldsConfig: TemplateField[];
}

interface CustomerFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; mobile?: string; email?: string; notes?: string; tags?: string }) => void;
  loading?: boolean;
  businessId?: string;
  businessType?: string;
}

function composeDescription(fields: TemplateField[], values: Record<string, string>): string {
  const lines = fields
    .map((f) => {
      const v = (values[f.key] ?? "").trim();
      return v ? `${f.label}: ${v}` : "";
    })
    .filter(Boolean);
  return lines.join("\n");
}

/**
 * Modal for adding a customer. Required: Name.
 * Mobile and email are optional but encouraged for better customer retention.
 * Description uses guided templates (Default or custom) with optional fields.
 */
export function CustomerFormModal({
  open,
  onClose,
  onSubmit,
  loading = false,
  businessId = "",
  businessType = "",
}: CustomerFormModalProps) {
  const { getToken } = useAuth();
  const [name, setName] = React.useState("");
  const [mobile, setMobile] = React.useState("");
  const [mobileError, setMobileError] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [showMore, setShowMore] = React.useState(false);
  const [templates, setTemplates] = React.useState<CustomerTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>("default");
  const [fieldValues, setFieldValues] = React.useState<Record<string, string>>({});
  const [customNotes, setCustomNotes] = React.useState("");
  const [templatesLoading, setTemplatesLoading] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? templates[0] ?? null;
  const fields = selectedTemplate?.fieldsConfig ?? [];

  React.useEffect(() => {
    if (!open) {
      setName("");
      setMobile("");
      setMobileError(null);
      setEmail("");
      setTags("");
      setShowMore(false);
      setFieldValues({});
      setCustomNotes("");
    }
  }, [open]);

  React.useEffect(() => {
    if (!open || !businessId || !getToken) return;
    setTemplatesLoading(true);
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const [listRes, defaultRes] = await Promise.all([
          apiRequest<{ templates: CustomerTemplate[] }>(
            `/customers/templates?businessId=${encodeURIComponent(businessId)}&businessType=${encodeURIComponent(businessType)}`,
            { token },
          ).catch(() => ({ templates: [] })),
          apiRequest<{ template: CustomerTemplate | null }>(
            `/customers/default-template?businessId=${encodeURIComponent(businessId)}`,
            { token },
          ).catch(() => ({ template: null })),
        ]);
        const list = listRes.templates ?? [];
        setTemplates(list);
        const defaultTpl = defaultRes.template;
        const defaultId = defaultTpl?.id ?? list[0]?.id ?? "default";
        const validId = list.some((t) => t.id === defaultId) ? defaultId : list[0]?.id ?? "default";
        setSelectedTemplateId(validId);
        setFieldValues({});
      } catch {
        setTemplates([]);
      } finally {
        setTemplatesLoading(false);
      }
    })();
  }, [open, businessId, businessType, getToken]);

  const handleFieldChange = (key: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const normalizedMobile = mobile.trim()
      ? normalizePhilippineMobileE164(mobile) ?? undefined
      : undefined;
    if (mobile.trim() && !normalizedMobile) {
      setMobileError(PH_MOBILE_E164_ERROR);
      return;
    }
    const composed = composeDescription(fields, fieldValues);
    const extra = customNotes.trim();
    const notes = [composed.trim(), extra].filter(Boolean).join("\n\n") || undefined;
    onSubmit({
      name: name.trim(),
      mobile: normalizedMobile,
      email: email.trim() || undefined,
      notes,
      tags: showMore ? (tags.trim() || undefined) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>Add customer</DialogTitle>
          <DialogDescription>
            Add people here and track their visits. You can edit details anytime.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="customer-name" className="mb-1 block text-base">
              Name <span className="text-destructive">(Required)</span>
            </Label>
            <Input
              id="customer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Maria Garcia"
              required
              className="w-full"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="customer-mobile" className="mb-1 block text-base">
              Mobile <span className="text-muted-foreground">(Optional, encouraged)</span>
            </Label>
            <p className="mb-1 text-sm text-muted-foreground">
              Helps with SMS reminders and customer retention.
            </p>
            <Input
              id="customer-mobile"
              type="tel"
              value={mobile}
              onChange={(e) => {
                setMobile(e.target.value);
                setMobileError(null);
              }}
              placeholder={PH_MOBILE_E164_PLACEHOLDER}
              className="w-full"
            />
            <p className="mt-1 text-sm text-muted-foreground">
              {PH_MOBILE_E164_ERROR}
            </p>
            {mobileError && (
              <p className="mt-1 text-sm text-destructive" role="alert">
                {mobileError}
              </p>
            )}
          </div>

          {showMore && (
            <>
          <div>
            <Label htmlFor="customer-email" className="mb-1 block text-base">
              Email <span className="text-muted-foreground">(Optional)</span>
            </Label>
            <Input
              id="customer-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. customer@example.com"
              className="w-full"
            />
          </div>

          <div>
            <Label className="mb-1 block text-base">
              Description <span className="text-muted-foreground">(Optional)</span>
            </Label>
            {businessId && (
              <>
                {/* Key forces remount when templates load so Radix doesn't reset value (it clears value when options are empty during async load) */}
                <Select
                  key={templatesLoading ? "loading" : `ready-${templates.length}`}
                  value={selectedTemplateId}
                  onValueChange={(v) => {
                    setSelectedTemplateId(v);
                    setFieldValues({});
                  }}
                  disabled={templatesLoading || templates.length === 0}
                >
                  <SelectTrigger className="mb-2 w-full">
                    <SelectValue placeholder={templatesLoading ? "Loading…" : "Template"} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fields.length > 0 ? (
                  <div className="space-y-2">
                    {fields.map((f) => (
                      <div key={f.key}>
                        <Label htmlFor={`field-${f.key}`} className="mb-0.5 block text-xs text-muted-foreground">
                          {f.label}
                        </Label>
                        <Input
                          id={`field-${f.key}`}
                          value={fieldValues[f.key] ?? ""}
                          onChange={(e) => handleFieldChange(f.key, e.target.value)}
                          placeholder={f.placeholder}
                          className="w-full"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <Textarea
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="Add notes or description…"
                    rows={3}
                    className="w-full"
                  />
                )}
                {fields.length > 0 && (
                  <Textarea
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="Additional notes (optional)"
                    rows={2}
                    className="mt-2 w-full"
                  />
                )}
              </>
            )}
            {!businessId && (
              <Textarea
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="Add notes or description…"
                rows={3}
                className="w-full"
              />
            )}
          </div>

          <div>
            <Label htmlFor="customer-tags" className="mb-1 block text-base">
              Labels <span className="text-muted-foreground">(Optional)</span>
            </Label>
            <Input
              id="customer-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. VIP, Regular"
              className="w-full"
            />
          </div>
            </>
          )}
          <button
            type="button"
            onClick={() => setShowMore(!showMore)}
            className="text-base text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            {showMore ? "Hide optional fields" : "Add more details (email, notes, labels)"}
          </button>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={loading || !name.trim()} className="min-h-[44px]">
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
