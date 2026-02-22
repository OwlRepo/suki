"use client";

import { useState, use, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface TemplateField {
  key: string;
  label: string;
  placeholder?: string;
}

interface IntakeTemplate {
  id: string;
  name: string;
  fieldsConfig: TemplateField[];
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

export default function IntakePage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = use(params);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [customNotes, setCustomNotes] = useState("");
  const [template, setTemplate] = useState<IntakeTemplate | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setConfigLoading(true);
    setConfigError(null);
    fetch(`${API_URL}/intake/config?businessId=${encodeURIComponent(businessId)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((data as { message?: string }).message || "Failed to load form");
        }
        return data as { template: IntakeTemplate | null };
      })
      .then((data) => {
        if (!cancelled) setTemplate(data.template);
      })
      .catch((e) => {
        if (!cancelled) setConfigError(e instanceof Error ? e.message : "Failed to load form");
      })
      .finally(() => {
        if (!cancelled) setConfigLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const fields = template?.fieldsConfig ?? [];

  const handleFieldChange = (key: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const composed = composeDescription(fields, fieldValues);
      const extra = customNotes.trim();
      const notes = [composed.trim(), extra].filter(Boolean).join("\n\n") || undefined;

      const res = await fetch(`${API_URL}/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          name: name.trim(),
          mobile: mobile.trim() || undefined,
          email: email.trim() || undefined,
          notes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { message?: string }).message || "Failed");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Thank you</h1>
        <p className="mt-4 text-base text-muted-foreground">
          Your information has been recorded. We will be in touch.
        </p>
      </div>
    );
  }

  if (configLoading) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-muted-foreground">Loading form…</p>
      </div>
    );
  }

  if (configError) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Unable to load form</h1>
        <p className="mt-4 text-base text-muted-foreground">{configError}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-center text-2xl font-semibold text-foreground">Customer intake</h1>
      <p className="mt-2 text-center text-base text-muted-foreground">
        Enter your details to join our list.
      </p>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <Label htmlFor="intake-name" className="mb-1 block">
            Name <span className="text-destructive">(Required)</span>
          </Label>
          <Input
            id="intake-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Juan Dela Cruz"
            required
            className="w-full"
            autoFocus
          />
        </div>
        <div>
          <Label htmlFor="intake-mobile" className="mb-1 block">
            Mobile <span className="text-muted-foreground">(Optional, encouraged)</span>
          </Label>
          <p className="mb-1 text-xs text-muted-foreground">
            Helps with SMS reminders and customer retention.
          </p>
          <Input
            id="intake-mobile"
            type="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="e.g. 09XX XXX XXXX"
            className="w-full"
          />
        </div>
        <div>
          <Label htmlFor="intake-email" className="mb-1 block">
            Email <span className="text-muted-foreground">(Optional, encouraged)</span>
          </Label>
          <p className="mb-1 text-xs text-muted-foreground">
            Helps with email outreach and follow-ups.
          </p>
          <Input
            id="intake-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. customer@example.com"
            className="w-full"
          />
        </div>

        {fields.length > 0 && (
          <div className="space-y-2">
            {fields.map((f) => (
              <div key={f.key}>
                <Label htmlFor={`intake-field-${f.key}`} className="mb-0.5 block text-xs text-muted-foreground">
                  {f.label}
                </Label>
                <Input
                  id={`intake-field-${f.key}`}
                  value={fieldValues[f.key] ?? ""}
                  onChange={(e) => handleFieldChange(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full"
                />
              </div>
            ))}
            <div>
              <Label htmlFor="intake-notes" className="mb-0.5 block text-xs text-muted-foreground">
                Additional notes (Optional)
              </Label>
              <Textarea
                id="intake-notes"
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="Additional notes (optional)"
                rows={2}
                className="w-full"
              />
            </div>
          </div>
        )}

        {fields.length === 0 && (
          <div>
            <Label htmlFor="intake-notes" className="mb-1 block">
              Additional notes <span className="text-muted-foreground">(Optional)</span>
            </Label>
            <Textarea
              id="intake-notes"
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="Add notes or description…"
              rows={3}
              className="w-full"
            />
          </div>
        )}

        {error && (
          <p className="text-base text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" className="min-h-[44px] w-full" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit"}
        </Button>
      </form>
    </div>
  );
}
