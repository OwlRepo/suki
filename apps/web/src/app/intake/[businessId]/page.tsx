"use client";

import { useState, use, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MonthPicker } from "@/components/ui/date-pickers";
import { AvailabilityCalendar } from "@/components/ui/availability-calendar";
import { normalizeApiError } from "./error-utils";
import { buildWizardSteps, type ScheduleSubStep } from "./wizard-progress";
import { filterDayKeysByMonth } from "./schedule-utils";
import { buildApiUrl } from "@/lib/api-base";
import {
  PH_MOBILE_E164_ERROR,
  PH_MOBILE_E164_PLACEHOLDER,
  normalizePhilippineMobileE164,
} from "@tyvera/types";

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

type Step = "form" | "schedule" | "review" | "otp" | "done";

type OtpSendResponse = {
  success: boolean;
  reused: boolean;
  holdExpiresAt?: string;
  resendAvailableAt?: string;
  sendsRemaining?: number;
};

type ApiErrorBody = {
  code?: string;
  message?: string | string[];
  error?: string | string[];
};

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

function getCountdownLabel(targetIso: string | null, fallback: string): string {
  if (!targetIso) return fallback;
  const diffMs = new Date(targetIso).getTime() - Date.now();
  if (diffMs <= 0) return "0s";
  const totalSeconds = Math.ceil(diffMs / 1000);
  if (totalSeconds >= 60) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
  }
  return `${totalSeconds}s`;
}

function extractApiCode(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const maybeCode = (data as ApiErrorBody).code;
  return typeof maybeCode === "string" && maybeCode.trim().length > 0 ? maybeCode : null;
}

function mapPublicOtpError(code: string | null, fallback: string): string {
  switch (code) {
    case "OTP_BILLING_BLOCKED":
      return "Bookings are temporarily unavailable right now. Please try again shortly or contact the business directly.";
    case "OTP_RESEND_COOLDOWN":
      return "Please wait a moment before requesting another code.";
    case "OTP_HOLD_SEND_LIMIT":
      return "We’ve already sent the maximum number of codes for this booking attempt. Please restart your booking.";
    case "OTP_MOBILE_RATE_LIMIT":
    case "OTP_IP_RATE_LIMIT":
    case "OTP_BUSINESS_DAILY_LIMIT":
      return "Too many verification attempts were requested. Please try again later.";
    case "OTP_PROVIDER_UNAVAILABLE":
      return "We couldn’t send a verification code right now. Please try again shortly.";
    case "OTP_SLOT_CONFLICT":
      return "That time slot was just taken. Please choose another available time.";
    case "OTP_INVALID_CODE":
      return "That code doesn’t look right. Please try again.";
    case "OTP_MAX_ATTEMPTS":
      return "Too many incorrect code attempts. Please request a new code.";
    case "OTP_HOLD_EXPIRED":
      return "Your hold expired. Please choose a time again.";
    default:
      return fallback;
  }
}

export default function IntakePage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = use(params);
  const localStorageKey = useMemo(() => `tyvera:intake:${businessId}`, [businessId]);

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
  const [scheduleSubStep, setScheduleSubStep] = useState<ScheduleSubStep>("date");
  const [holdId, setHoldId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState<string | null>(null);
  const [sendsRemaining, setSendsRemaining] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState<number>(Date.now());

  useEffect(() => {
    let cancelled = false;
    setConfigLoading(true);
    setConfigError(null);
    fetch(buildApiUrl(`/intake/config?businessId=${encodeURIComponent(businessId)}`))
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

    fetch(buildApiUrl(`/intake/availability?businessId=${encodeURIComponent(businessId)}&month=${encodeURIComponent(month)}`))
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
        const sortedDays = Object.keys(data.byDay ?? {}).sort();
        const firstDay = sortedDays[0] ?? null;
        setSelectedDay(firstDay);
        setSelectedSlot(firstDay ? (data.byDay[firstDay]?.[0] ?? null) : null);
        setScheduleSubStep("date");
      })
      .catch((e) => {
        if (!cancelled) {
          const message =
            e instanceof Error && e.message.trim().length > 0
              ? e.message
              : "We’re having trouble loading available slots right now. Please try again.";
          setAvailabilityError(
            message === "Internal server error"
              ? "We’re having trouble loading available slots right now. Please try again."
              : message,
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
  const dayKeys = filterDayKeysByMonth(Object.keys(availability?.byDay ?? {}).sort(), month);
  const slotsForDay = selectedDay ? availability?.byDay[selectedDay] ?? [] : [];
  const wizardSteps = buildWizardSteps(step, scheduleSubStep);
  const selectedDateLabel = selectedDay
    ? new Date(selectedDay).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
    : "None selected";
  const selectedTimeLabel = selectedSlot ? formatSlotLabel(selectedSlot) : "None selected";
  const resendCooldownActive = !!resendAvailableAt && new Date(resendAvailableAt).getTime() > nowTick;
  const holdExpired = !!holdExpiresAt && new Date(holdExpiresAt).getTime() <= nowTick;

  useEffect(() => {
    if (step !== "otp") return;
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [step]);

  const jumpToWizardStep = (stepId: "details" | "date" | "time" | "review" | "verify") => {
    if (stepId === "details") setStep("form");
    if (stepId === "date") {
      setStep("schedule");
      setScheduleSubStep("date");
    }
    if (stepId === "time" && selectedDay) {
      setStep("schedule");
      setScheduleSubStep("time");
    }
    if (stepId === "review" && selectedSlot) setStep("review");
  };

  const renderWizardProgress = () => (
    <ol className="mb-8 grid grid-cols-5 items-start gap-2" aria-label="Booking progress">
      {wizardSteps.map((wizardStep, index) => (
        <li key={wizardStep.id} className="relative">
          {index < wizardSteps.length - 1 && (
            <span
              aria-hidden="true"
              className="absolute left-[calc(50%+18px)] top-[15px] h-[2px] w-[calc(100%-12px)] bg-border"
            />
          )}
          <div
            data-testid="intake-progress-step"
            data-state={wizardStep.state}
            aria-current={wizardStep.ariaCurrent}
            className="space-y-1 text-center"
          >
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted/20 text-xs font-semibold text-foreground data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=done]:border-primary/60 data-[state=done]:bg-primary/20">
              {index + 1}
            </div>
            <p className="text-xs font-medium text-muted-foreground data-[state=active]:text-foreground">
              {wizardStep.label.replace(/^\d+\s/, "")}
            </p>
          </div>
          {wizardStep.state === "done" && wizardStep.id !== "verify" && (
            <button
              type="button"
              className="mx-auto mt-1 block text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              onClick={() => jumpToWizardStep(wizardStep.id)}
            >
              Edit
            </button>
          )}
        </li>
      ))}
    </ol>
  );

  const handleFieldChange = (key: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const normalizedMobile = mobile.trim()
      ? normalizePhilippineMobileE164(mobile)
      : null;
    if (mobile.trim() && !normalizedMobile) {
      setError(PH_MOBILE_E164_ERROR);
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const composed = composeDescription(fields, fieldValues);
      const extra = customNotes.trim();
      const notes = [composed.trim(), extra].filter(Boolean).join("\n\n") || undefined;

      const res = await fetch(buildApiUrl("/intake"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          name: name.trim(),
          mobile: normalizedMobile ?? undefined,
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
          mobile: normalizedMobile ?? "",
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
    const normalizedMobile = normalizePhilippineMobileE164(mobile);
    if (!normalizedMobile) {
      setError(PH_MOBILE_E164_ERROR);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const holdRes = await fetch(buildApiUrl("/intake/hold"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          customerId,
          mobile: normalizedMobile,
          scheduledAt: selectedSlot,
        }),
      });
      const holdData = await holdRes.json().catch(() => ({}));
      if (!holdRes.ok) {
        throw new Error(normalizeApiError(holdData, "Failed to hold slot"));
      }

      const createdHoldId = (holdData as { hold?: { id: string } }).hold?.id;
      if (!createdHoldId) throw new Error("Failed to create hold");

      const otpRes = await fetch(buildApiUrl("/intake/otp/send"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdId: createdHoldId }),
      });
      const otpData = await otpRes.json().catch(() => ({}));
      if (!otpRes.ok) {
        throw new Error(
          mapPublicOtpError(
            extractApiCode(otpData),
            normalizeApiError(otpData, "Failed to send OTP"),
          ),
        );
      }

      const otpResponse = otpData as OtpSendResponse;
      setHoldId(createdHoldId);
      setOtpCode("");
      setHoldExpiresAt(otpResponse.holdExpiresAt ?? null);
      setResendAvailableAt(otpResponse.resendAvailableAt ?? null);
      setSendsRemaining(
        typeof otpResponse.sendsRemaining === "number" ? otpResponse.sendsRemaining : null,
      );
      setNowTick(Date.now());
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
      const res = await fetch(buildApiUrl("/intake/otp/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdId, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = extractApiCode(data);
        if (code === "OTP_SLOT_CONFLICT") {
          setAvailabilityReloadNonce((prev) => prev + 1);
          setScheduleSubStep("date");
          setStep("schedule");
          throw new Error(mapPublicOtpError(code, "Invalid OTP"));
        }
        if (code === "OTP_HOLD_EXPIRED") {
          setScheduleSubStep("date");
          setStep("schedule");
        }
        throw new Error(mapPublicOtpError(code, normalizeApiError(data, "Invalid OTP")));
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
        {renderWizardProgress()}
        <h1 className="text-center text-2xl font-semibold text-foreground">Verify your booking</h1>
        <p className="mt-2 text-center text-base text-muted-foreground">
          Enter the 6-digit OTP sent to {mobile || "your mobile"}.
        </p>
        {selectedSlot && (
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Selected slot: {new Date(selectedSlot).toLocaleString()}
          </p>
        )}
        <div className="mt-3 space-y-1 text-center text-sm text-muted-foreground">
          <p>Hold expires in {getCountdownLabel(holdExpiresAt, "0s")}</p>
          <p>Resend available in {getCountdownLabel(resendAvailableAt, "0s")}</p>
          {typeof sendsRemaining === "number" ? <p>{sendsRemaining} sends remaining</p> : null}
        </div>
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
            disabled={!holdId || submitting || resendCooldownActive || holdExpired}
            onClick={async () => {
              if (!holdId) return;
              setSubmitting(true);
              setError(null);
              try {
                const res = await fetch(buildApiUrl("/intake/otp/send"), {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ holdId }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  throw new Error(
                    mapPublicOtpError(
                      extractApiCode(data),
                      normalizeApiError(data, "Failed to resend OTP"),
                    ),
                  );
                }
                const otpResponse = data as OtpSendResponse;
                setHoldExpiresAt(otpResponse.holdExpiresAt ?? holdExpiresAt);
                setResendAvailableAt(otpResponse.resendAvailableAt ?? resendAvailableAt);
                setSendsRemaining(
                  typeof otpResponse.sendsRemaining === "number"
                    ? otpResponse.sendsRemaining
                    : sendsRemaining,
                );
                setNowTick(Date.now());
              } catch (e) {
                setError(e instanceof Error ? e.message : "Failed to resend OTP");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {resendCooldownActive ? "Resend OTP (cooldown active)" : "Resend OTP"}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "review") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        {renderWizardProgress()}
        <h1 className="text-center text-2xl font-semibold text-foreground">Review your booking</h1>
        <p className="mt-2 text-center text-base text-muted-foreground">
          Please confirm your details before we send an OTP to verify this booking.
        </p>

        <div className="mt-8 space-y-4 rounded-lg border border-border bg-card p-4">
          <div className="grid gap-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Appointment</p>
            <p className="text-sm font-medium text-foreground">
              {selectedDateLabel} at {selectedTimeLabel}
            </p>
          </div>
          <div className="grid gap-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Customer</p>
            <p className="text-sm text-foreground">{name || "No name provided"}</p>
            <p className="text-sm text-muted-foreground">{mobile || "No mobile provided"}</p>
            {email && <p className="text-sm text-muted-foreground">{email}</p>}
          </div>
        </div>

        {error && (
          <p className="mt-4 text-base text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] w-full"
            onClick={() => {
              setStep("schedule");
              setScheduleSubStep("time");
            }}
          >
            Back to time
          </Button>
          <Button
            type="button"
            className="min-h-[44px] w-full"
            disabled={!selectedSlot || submitting}
            onClick={handleHoldAndSendOtp}
          >
            {submitting ? "Preparing OTP…" : "Proceed to OTP"}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "schedule") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        {renderWizardProgress()}
        <h1 className="text-center text-2xl font-semibold text-foreground">Choose your appointment</h1>
        <p className="mt-2 text-center text-base text-muted-foreground">
          Pick your date first, then choose a time slot.
        </p>

        <div className="mt-6">
          <Label className="mb-1 block">Month</Label>
          <MonthPicker value={month} onChange={setMonth} className="w-full sm:w-60 justify-start" />
        </div>

        {availabilityLoading ? (
          <div className="mt-6 space-y-3" aria-live="polite">
            <p className="text-muted-foreground">Loading available slots…</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="h-11 animate-pulse rounded-md border border-border bg-muted/30" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <div
              data-testid="intake-selected-summary"
              className="sticky top-3 z-10 mt-6 rounded-md border border-border bg-background/95 p-3 backdrop-blur"
            >
              <p className="text-sm text-muted-foreground">Selected appointment</p>
              <p className="text-sm font-medium text-foreground">
                {selectedDateLabel} at {selectedTimeLabel}
              </p>
            </div>

            {scheduleSubStep === "date" && (
              <div className="mt-6">
                <h2 className="mb-2 text-sm font-medium text-foreground">Available days</h2>
                <div>
                  {dayKeys.length === 0 && (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">No slots available in this month.</p>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-[44px]"
                        onClick={() => {
                          const [year, monthValue] = month.split("-").map((item) => Number(item));
                          if (!year || !monthValue) return;
                          const next = new Date(year, monthValue, 1);
                          setMonth(toLocalMonthValue(next));
                        }}
                      >
                        Try another month
                      </Button>
                    </div>
                  )}
                  <AvailabilityCalendar
                    month={month}
                    selectedDay={selectedDay}
                    availableDays={dayKeys}
                    onSelect={(day) => {
                      setSelectedDay(day);
                      const daySlots = availability?.byDay[day] ?? [];
                      setSelectedSlot(daySlots[0] ?? null);
                    }}
                  />
                </div>
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
                    disabled={!selectedDay}
                    onClick={() => {
                      if (!selectedDay) return;
                      if (!selectedSlot) {
                        const first = availability?.byDay[selectedDay]?.[0] ?? null;
                        setSelectedSlot(first);
                      }
                      setScheduleSubStep("time");
                    }}
                  >
                    Continue to time
                  </Button>
                </div>
              </div>
            )}

            {scheduleSubStep === "time" && selectedDay && (
              <div className="mt-6">
                <h2 className="mb-2 text-sm font-medium text-foreground">Available time slots</h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {slotsForDay.map((slot) => (
                    <Button
                      key={slot}
                      variant={selectedSlot === slot ? "default" : "outline"}
                      className="min-h-[44px] w-full"
                      onClick={() => setSelectedSlot(slot)}
                    >
                      {formatSlotLabel(slot)}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {scheduleSubStep === "time" && selectedDay && (
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px] w-full"
                  onClick={() => setScheduleSubStep("date")}
                >
                  Back to date
                </Button>
                <Button
                  type="button"
                  className="min-h-[44px] w-full"
                  disabled={!selectedSlot || submitting}
                  onClick={() => setStep("review")}
                >
                  Continue to review
                </Button>
              </div>
            )}
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
      {renderWizardProgress()}
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
            onChange={(e) => {
              setMobile(e.target.value);
              if (error === PH_MOBILE_E164_ERROR) setError(null);
            }}
            placeholder={PH_MOBILE_E164_PLACEHOLDER}
            className="w-full"
            required
          />
          <p className="mt-1 text-sm text-muted-foreground">
            {PH_MOBILE_E164_ERROR}
          </p>
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
