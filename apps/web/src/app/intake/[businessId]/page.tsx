"use client";

import { useState, use, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { normalizeApiError } from "./error-utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const OTP_LENGTH = 6;

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

interface Availability {
  month: string;
  slotDurationMins: number;
  byDay: Record<string, string[]>;
}

type Step = "form" | "schedule" | "otp" | "done";

function composeDescription(fields: TemplateField[], values: Record<string, string>): string {
  const lines = fields
    .map((f) => {
      const v = (values[f.key] ?? "").trim();
      return v ? `${f.label}: ${v}` : "";
    })
    .filter(Boolean);
  return lines.join("\n");
}

function toLocalMonthValue(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatSlotLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function IntakePage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = use(params);
  const localStorageKey = useMemo(() => `suki:intake:${businessId}`, [businessId]);

  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [customNotes, setCustomNotes] = useState("");
  const [template, setTemplate] = useState<IntakeTemplate | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityReloadNonce, setAvailabilityReloadNonce] = useState(0);

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [month, setMonth] = useState<string>(toLocalMonthValue());
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [holdId, setHoldId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpSubmitting, setOtpSubmitting] = useState(false);

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(localStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        name?: string;
        mobile?: string;
        email?: string;
        fieldValues?: Record<string, string>;
        customNotes?: string;
      };
      setName(parsed.name ?? "");
      setMobile(parsed.mobile ?? "");
      setEmail(parsed.email ?? "");
      setFieldValues(parsed.fieldValues ?? {});
      setCustomNotes(parsed.customNotes ?? "");
    } catch {
      // ignore malformed cache
    }
  }, [localStorageKey]);

  useEffect(() => {
    if (step !== "schedule") return;
    let cancelled = false;
    setAvailabilityLoading(true);
    setAvailabilityError(null);

    fetch(`${API_URL}/intake/availability?businessId=${encodeURIComponent(businessId)}&month=${encodeURIComponent(month)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            normalizeApiError(
              data,
              "We’re having trouble loading available slots right now. Please try again.",
            ),
          );
        }
        return data as Availability;
      })
      .then((data) => {
        if (cancelled) return;
        setAvailability(data);
        setSelectedDay(null);
        setSelectedSlot(null);
      })
      .catch((e) => {
        if (!cancelled) {
          setAvailabilityError(
            e instanceof Error
              ? e.message
              : "We’re having trouble loading available slots right now. Please try again.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setAvailabilityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [step, businessId, month, availabilityReloadNonce]);

  const fields = template?.fieldsConfig ?? [];
  const dayKeys = Object.keys(availability?.byDay ?? {}).sort();
  const slotsForDay = selectedDay ? availability?.byDay[selectedDay] ?? [] : [];

  const handleFieldChange = (key: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
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
      if (!res.ok) {
        throw new Error(normalizeApiError(data, "Failed to save your details. Please try again."));
      }

      const customer = (data as { customer?: { id: string } }).customer;
      if (!customer?.id) throw new Error("Missing customer id");
      setCustomerId(customer.id);

      localStorage.setItem(
        localStorageKey,
        JSON.stringify({
          name: name.trim(),
          mobile: mobile.trim(),
          email: email.trim(),
          fieldValues,
          customNotes,
        }),
      );

      setStep("schedule");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleHoldAndSendOtp = async () => {
    if (!customerId || !selectedSlot) return;
    if (!mobile.trim()) {
      setError("Mobile number is required for OTP verification.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const holdRes = await fetch(`${API_URL}/intake/hold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          customerId,
          mobile: mobile.trim(),
          scheduledAt: selectedSlot,
        }),
      });
      const holdData = await holdRes.json().catch(() => ({}));
      if (!holdRes.ok) {
        throw new Error(normalizeApiError(holdData, "Failed to hold slot"));
      }

      const createdHoldId = (holdData as { hold?: { id: string } }).hold?.id;
      if (!createdHoldId) throw new Error("Failed to create hold");

      const otpRes = await fetch(`${API_URL}/intake/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdId: createdHoldId }),
      });
      const otpData = await otpRes.json().catch(() => ({}));
      if (!otpRes.ok) {
        throw new Error(normalizeApiError(otpData, "Failed to send OTP"));
      }

      setHoldId(createdHoldId);
      setOtpCode("");
      setStep("otp");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to continue");
    } finally {
      setSubmitting(false);
    }
  };

  const submitOtp = async (code: string) => {
    if (!holdId) return;
    setOtpSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/intake/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdId, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(normalizeApiError(data, "Invalid OTP"));
      }
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "OTP verification failed");
    } finally {
      setOtpSubmitting(false);
    }
  };

  const handleOtpChange = (value: string) => {
    const next = value.replace(/\D/g, "").slice(0, OTP_LENGTH);
    setOtpCode(next);
    if (next.length === OTP_LENGTH && !otpSubmitting) {
      void submitOtp(next);
    }
  };

  if (step === "done") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Booking confirmed</h1>
        <p className="mt-4 text-base text-muted-foreground">
          Your appointment has been reserved. See you soon.
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

  if (step === "otp") {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-center text-2xl font-semibold text-foreground">Verify your booking</h1>
        <p className="mt-2 text-center text-base text-muted-foreground">
          Enter the 6-digit OTP sent to {mobile || "your mobile"}.
        </p>
        {selectedSlot && (
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Selected slot: {new Date(selectedSlot).toLocaleString()}
          </p>
        )}
        <div className="mt-8 space-y-4">
          <div>
            <Label htmlFor="otp-code" className="mb-1 block">
              OTP code
            </Label>
            <Input
              id="otp-code"
              value={otpCode}
              onChange={(e) => handleOtpChange(e.target.value)}
              placeholder="Enter 6-digit code"
              maxLength={OTP_LENGTH}
              inputMode="numeric"
              autoFocus
              className="w-full"
            />
          </div>
          {otpSubmitting && <p className="text-sm text-muted-foreground">Verifying code…</p>}
          {error && (
            <p className="text-base text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] w-full"
            disabled={!holdId || submitting}
            onClick={async () => {
              if (!holdId) return;
              setSubmitting(true);
              setError(null);
              try {
                const res = await fetch(`${API_URL}/intake/otp/send`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ holdId }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  throw new Error(normalizeApiError(data, "Failed to resend OTP"));
                }
              } catch (e) {
                setError(e instanceof Error ? e.message : "Failed to resend OTP");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            Resend OTP
          </Button>
        </div>
      </div>
    );
  }

  if (step === "schedule") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-center text-2xl font-semibold text-foreground">Choose your appointment</h1>
        <p className="mt-2 text-center text-base text-muted-foreground">
          Pick a month, day, then your available time slot.
        </p>

        <div className="mt-6">
          <Label htmlFor="booking-month" className="mb-1 block">Month</Label>
          <Input
            id="booking-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-full sm:w-60"
          />
        </div>

        {availabilityLoading ? (
          <p className="mt-6 text-muted-foreground">Loading available slots…</p>
        ) : (
          <>
            <div className="mt-6">
              <h2 className="mb-2 text-sm font-medium text-foreground">Available days</h2>
              <div className="flex flex-wrap gap-2">
                {dayKeys.length === 0 && (
                  <p className="text-sm text-muted-foreground">No slots available in this month.</p>
                )}
                {dayKeys.map((day) => (
                  <Button
                    key={day}
                    variant={selectedDay === day ? "default" : "outline"}
                    onClick={() => {
                      setSelectedDay(day);
                      setSelectedSlot(null);
                    }}
                  >
                    {new Date(day).toLocaleDateString([], { month: "short", day: "numeric" })}
                  </Button>
                ))}
              </div>
            </div>

            {selectedDay && (
              <div className="mt-6">
                <h2 className="mb-2 text-sm font-medium text-foreground">Available time slots</h2>
                <div className="flex flex-wrap gap-2">
                  {slotsForDay.map((slot) => (
                    <Button
                      key={slot}
                      variant={selectedSlot === slot ? "default" : "outline"}
                      onClick={() => setSelectedSlot(slot)}
                    >
                      {formatSlotLabel(slot)}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] w-full"
                onClick={() => setStep("form")}
              >
                Back to form
              </Button>
              <Button
                type="button"
                className="min-h-[44px] w-full"
                disabled={!selectedSlot || submitting}
                onClick={handleHoldAndSendOtp}
              >
                {submitting ? "Reserving…" : "Confirm slot"}
              </Button>
            </div>
          </>
        )}

        {error && (
          <p className="mt-4 text-base text-destructive" role="alert">
            {error}
          </p>
        )}
        {availabilityError && (
          <div className="mt-4 space-y-3" role="alert" aria-live="polite">
            <p className="text-base text-destructive">{availabilityError}</p>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              onClick={() => setAvailabilityReloadNonce((prev) => prev + 1)}
              disabled={availabilityLoading}
            >
              {availabilityLoading ? "Retrying..." : "Retry"}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-center text-2xl font-semibold text-foreground">Customer intake</h1>
      <p className="mt-2 text-center text-base text-muted-foreground">
        Fill out once and we will remember your details on this device.
      </p>
      <form onSubmit={handleSubmitForm} className="mt-8 space-y-4">
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
            Mobile <span className="text-destructive">(Required for booking OTP)</span>
          </Label>
          <Input
            id="intake-mobile"
            type="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="e.g. 09XX XXX XXXX"
            className="w-full"
            required
          />
        </div>
        <div>
          <Label htmlFor="intake-email" className="mb-1 block">
            Email <span className="text-muted-foreground">(Optional)</span>
          </Label>
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
          {submitting ? "Saving…" : "Continue to booking"}
        </Button>
      </form>
    </div>
  );
}
