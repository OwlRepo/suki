"use client";

import {
  useState,
  use,
  useEffect,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MonthPicker } from "@/components/ui/date-pickers";
import { AvailabilityCalendar } from "@/components/ui/availability-calendar";
import { normalizeApiError } from "./error-utils";
import { buildWizardSteps, type ScheduleSubStep } from "./wizard-progress";
import { filterDayKeysByMonth } from "./schedule-utils";
import { buildApiUrl } from "@/lib/api-base";
import { cn } from "@/lib/utils";
import {
  PH_MOBILE_E164_ERROR,
  PH_MOBILE_E164_PLACEHOLDER,
  normalizePhilippineMobileE164,
} from "@tyvera/types";
import { deriveBrandTheme } from "@/lib/brand-theme";

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

interface IntakeBusiness {
  name: string;
  businessType: string;
  brandColor?: string | null;
  logoUrl?: string | null;
  tagline?: string | null;
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

type IntakeConfigResponse = {
  template: IntakeTemplate | null;
  business: IntakeBusiness | null;
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

function buildBusinessMonogram(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (words.length === 0) return "B";

  return words.map((word) => word[0]?.toUpperCase() ?? "").join("");
}

function formatBusinessTypeLabel(value: string) {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function BrandHeader({
  business,
}: {
  business: IntakeBusiness;
}) {
  const monogram = buildBusinessMonogram(business.name);

  return (
    <Card className="relative overflow-hidden rounded-[32px] border-border/70 bg-white/92 px-4 py-4 shadow-[0_18px_55px_rgba(15,23,42,0.09)] sm:px-5 sm:py-5">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,var(--brand-raw,var(--primary)),color-mix(in_oklch,var(--brand-raw,var(--primary))_70%,white),var(--primary))]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_oklch,var(--brand-raw,var(--primary))_14%,white),transparent_34%),radial-gradient(circle_at_bottom_left,color-mix(in_oklch,var(--brand-raw,var(--primary))_9%,white),transparent_28%)]"
      />
      <div
        aria-hidden="true"
        className="absolute right-[-44px] top-[-44px] h-32 w-32 rounded-full border border-white/70 bg-white/35 blur-2xl"
      />

      <div className="relative grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
        <div className="order-2 flex min-w-0 flex-col items-center text-center sm:order-1 sm:items-start sm:text-left">
          <div
            className="brand-stagger flex flex-wrap items-center justify-center gap-2 sm:justify-start"
            style={{ animationDelay: "0ms" }}
          >
            <span className="rounded-full border border-black/5 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 shadow-sm backdrop-blur">
              Online intake
            </span>
            <Badge className="w-fit rounded-full bg-primary px-3 py-1 text-primary-foreground shadow-sm">
              {formatBusinessTypeLabel(business.businessType)}
            </Badge>
          </div>

          <div
            className="brand-stagger mt-3 flex flex-col items-center gap-3 sm:items-start"
            style={{ animationDelay: "60ms" }}
          >
            <h1 className="max-w-[12ch] text-4xl leading-none font-semibold tracking-[-0.04em] text-balance text-slate-950 sm:max-w-none sm:text-[3.4rem]">
              {business.name}
            </h1>

            {business.tagline ? (
              <p className="max-w-[28ch] text-pretty text-base leading-7 text-slate-600 sm:max-w-[38ch]">
                {business.tagline}
              </p>
            ) : (
              <p className="max-w-[28ch] text-pretty text-sm leading-6 text-slate-500 sm:max-w-[36ch] sm:text-base">
                Book in minutes with a polished, brand-first intake flow.
              </p>
            )}
          </div>

          <div
            className="brand-stagger mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start"
            style={{ animationDelay: "120ms" }}
          >
            <div className="rounded-full border border-black/5 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm">
              Fast booking
            </div>
            <div className="rounded-full border border-black/5 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm">
              Mobile ready
            </div>
          </div>
        </div>

        <div
          className="brand-stagger order-1 flex justify-center sm:order-2 sm:justify-end"
          style={{ animationDelay: "30ms" }}
        >
          <div
            className="relative flex h-[128px] w-[128px] items-center justify-center overflow-hidden rounded-[28px] border border-white/75 shadow-[0_20px_40px_rgba(15,23,42,0.12)] outline outline-1 outline-black/[0.05] outline-offset-[-1px] sm:h-[150px] sm:w-[150px]"
            style={{
              background:
                "linear-gradient(180deg,color-mix(in oklch, var(--brand-raw, var(--primary)) 24%, white),color-mix(in oklch, var(--brand-raw, var(--primary)) 10%, white))",
            }}
          >
            <div
              aria-hidden="true"
              className="absolute inset-x-4 top-3 h-5 rounded-full bg-white/40 blur-xl"
            />
            {business.logoUrl ? (
              <img
                src={business.logoUrl}
                alt={`${business.name} logo`}
                width={150}
                height={150}
                decoding="async"
                className="relative z-10 size-full object-cover"
                style={{
                  outline: "1px solid rgba(0, 0, 0, 0.06)",
                  outlineOffset: "-1px",
                }}
              />
            ) : (
              <span
                aria-hidden="true"
                className="relative z-10 text-4xl font-semibold tracking-[0.18em] sm:text-5xl"
                style={{ color: "var(--brand-on-light, var(--primary))" }}
              >
                {monogram}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function BrandHeaderSkeleton() {
  return (
    <Card className="overflow-hidden rounded-[32px] border-border/70 bg-white/92 px-4 py-4 shadow-[0_18px_55px_rgba(15,23,42,0.09)]">
      <div className="h-1.5 animate-pulse rounded-full bg-primary/20" />
      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="order-2 min-w-0 space-y-3 text-center sm:order-1 sm:text-left">
          <div className="mx-auto h-6 w-36 animate-pulse rounded-full bg-muted/70 sm:mx-0" />
          <div className="mx-auto h-12 w-52 animate-pulse rounded-[20px] bg-muted sm:mx-0" />
          <div className="mx-auto h-4 w-44 animate-pulse rounded-full bg-muted/80 sm:mx-0" />
        </div>
        <div className="order-1 mx-auto h-32 w-32 animate-pulse rounded-[28px] bg-muted sm:order-2 sm:mx-0 sm:h-[150px] sm:w-[150px]" />
      </div>
    </Card>
  );
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
  const [business, setBusiness] = useState<IntakeBusiness | null>(null);
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
        return data as IntakeConfigResponse;
      })
      .then((data) => {
        if (!cancelled) {
          setTemplate(data.template);
          setBusiness(data.business);
        }
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
  const brandTheme = useMemo(
    () => deriveBrandTheme(business?.brandColor ?? null),
    [business?.brandColor],
  );
  const brandVars = useMemo<CSSProperties | undefined>(() => {
    if (!brandTheme) return undefined;
    return {
      "--primary": brandTheme.primary,
      "--primary-foreground": brandTheme.primaryForeground,
      "--ring": brandTheme.ring,
      "--brand-raw": business?.brandColor ?? brandTheme.ring,
      "--brand-on-light": brandTheme.onLight,
    } as CSSProperties;
  }, [brandTheme, business?.brandColor]);
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
    <ol
      className="mb-6 flex snap-x gap-2 overflow-x-auto pb-2 [scrollbar-width:none] sm:mb-8 sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden"
      aria-label="Booking progress"
    >
      {wizardSteps.map((wizardStep, index) => (
        <li
          key={wizardStep.id}
          className="relative min-w-[92px] flex-1 snap-start sm:min-w-0"
        >
          {index < wizardSteps.length - 1 ? (
            <span
              aria-hidden="true"
              className="absolute left-[calc(50%+18px)] top-[15px] hidden h-[2px] w-[calc(100%-12px)] bg-border sm:block"
            />
          ) : null}
          <div
            data-testid="intake-progress-step"
            aria-current={wizardStep.ariaCurrent}
            className={cn(
              "space-y-1 rounded-2xl border border-border/70 bg-background/85 px-2 py-2 text-center shadow-sm sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none",
              wizardStep.state === "active" && "border-primary/40 bg-primary/5",
              wizardStep.state === "done" && "border-primary/25 bg-primary/4",
            )}
          >
            <div
              className={cn(
                "mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted/20 text-xs font-semibold text-foreground",
                wizardStep.state === "active" &&
                  "border-primary bg-primary text-primary-foreground",
                wizardStep.state === "done" &&
                  "border-primary/60 bg-primary/12 text-foreground",
              )}
            >
              {index + 1}
            </div>
            <p
              className={cn(
                "text-[11px] leading-tight font-medium text-muted-foreground sm:text-xs",
                wizardStep.state === "active" && "text-foreground",
              )}
            >
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

  let content: ReactNode;

  if (configLoading) {
    content = (
      <div className="mx-auto max-w-md px-4 py-6 text-center sm:py-8">
        <p className="text-base text-muted-foreground" aria-live="polite">
          Loading form…
        </p>
      </div>
    );
  } else if (configError) {
    content = (
      <div className="mx-auto max-w-md rounded-[28px] border border-border/70 bg-background/90 px-4 py-6 text-center shadow-sm sm:py-8">
        <h2 className="text-2xl font-semibold text-foreground">
          Unable to load form
        </h2>
        <p className="mt-4 text-base text-muted-foreground">{configError}</p>
      </div>
    );
  } else if (step === "done") {
    content = (
      <div className="mx-auto max-w-md rounded-[28px] border border-border/70 bg-background/90 px-4 py-6 text-center shadow-sm sm:py-8">
        <h2 className="text-2xl font-semibold text-foreground">
          Booking confirmed
        </h2>
        <p className="mt-4 text-base text-muted-foreground">
          Your appointment has been reserved. See you soon.
        </p>
      </div>
    );
  } else if (step === "otp") {
    content = (
      <div className="mx-auto max-w-md rounded-[28px] border border-border/70 bg-background/92 px-4 py-5 shadow-sm sm:px-6 sm:py-8">
        {renderWizardProgress()}
        <h2 className="text-center text-2xl font-semibold text-foreground">
          Verify your booking
        </h2>
        <p className="mt-2 text-center text-base text-muted-foreground">
          Enter 6-digit OTP sent to {mobile || "your mobile"}.
        </p>
        {selectedSlot ? (
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Selected slot: {new Date(selectedSlot).toLocaleString()}
          </p>
        ) : null}
        <div className="mt-4 rounded-2xl border border-border/70 bg-muted/20 px-3 py-3 text-center text-sm text-muted-foreground">
          <p>Hold expires in {getCountdownLabel(holdExpiresAt, "0s")}</p>
          <p>Resend available in {getCountdownLabel(resendAvailableAt, "0s")}</p>
          {typeof sendsRemaining === "number" ? (
            <p>{sendsRemaining} sends remaining</p>
          ) : null}
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
          {otpSubmitting ? (
            <p className="text-sm text-muted-foreground">Verifying code…</p>
          ) : null}
          {error ? (
            <p className="text-base text-destructive" role="alert">
              {error}
            </p>
          ) : null}
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
                setResendAvailableAt(
                  otpResponse.resendAvailableAt ?? resendAvailableAt,
                );
                setSendsRemaining(
                  typeof otpResponse.sendsRemaining === "number"
                    ? otpResponse.sendsRemaining
                    : sendsRemaining,
                );
                setNowTick(Date.now());
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Failed to resend OTP",
                );
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {resendCooldownActive
              ? "Resend OTP (cooldown active)"
              : "Resend OTP"}
          </Button>
        </div>
      </div>
    );
  } else if (step === "review") {
    content = (
      <div className="mx-auto max-w-2xl rounded-[28px] border border-border/70 bg-background/92 px-4 py-5 shadow-sm sm:px-6 sm:py-8">
        {renderWizardProgress()}
        <h2 className="text-center text-2xl font-semibold text-foreground">
          Review your booking
        </h2>
        <p className="mt-2 text-center text-base text-muted-foreground">
          Please confirm details before we send OTP to verify booking.
        </p>

        <div className="mt-8 space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="grid gap-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Appointment
            </p>
            <p className="text-sm font-medium text-foreground">
              {selectedDateLabel} at {selectedTimeLabel}
            </p>
          </div>
          <div className="grid gap-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Customer
            </p>
            <p className="text-sm text-foreground">
              {name || "No name provided"}
            </p>
            <p className="text-sm text-muted-foreground">
              {mobile || "No mobile provided"}
            </p>
            {email ? (
              <p className="text-sm text-muted-foreground">{email}</p>
            ) : null}
          </div>
        </div>

        {error ? (
          <p className="mt-4 text-base text-destructive" role="alert">
            {error}
          </p>
        ) : null}

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
  } else if (step === "schedule") {
    content = (
      <div className="mx-auto max-w-2xl rounded-[28px] border border-border/70 bg-background/92 px-4 py-5 shadow-sm sm:px-6 sm:py-8">
        {renderWizardProgress()}
        <h2 className="text-center text-2xl font-semibold text-foreground">
          Choose your appointment
        </h2>
        <p className="mt-2 text-center text-base text-muted-foreground">
          Pick date first, then choose time slot.
        </p>

        <div className="mt-6">
          <Label className="mb-1 block">Month</Label>
          <MonthPicker
            value={month}
            onChange={setMonth}
            className="w-full justify-start sm:w-60"
          />
        </div>

        {availabilityLoading ? (
          <div className="mt-6 space-y-3" aria-live="polite">
            <p className="text-muted-foreground">Loading available slots…</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-11 animate-pulse rounded-md border border-border bg-muted/30"
                />
              ))}
            </div>
          </div>
        ) : (
          <>
            <div
              data-testid="intake-selected-summary"
              className="sticky top-2 z-10 mt-6 rounded-2xl border border-border bg-background/95 p-3 shadow-sm backdrop-blur sm:top-3"
            >
              <p className="text-sm text-muted-foreground">
                Selected appointment
              </p>
              <p className="text-sm font-medium text-foreground">
                {selectedDateLabel} at {selectedTimeLabel}
              </p>
            </div>

            {scheduleSubStep === "date" ? (
              <div className="mt-6">
                <h3 className="mb-2 text-sm font-medium text-foreground">
                  Available days
                </h3>
                <div>
                  {dayKeys.length === 0 ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        No slots available in this month.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-[44px]"
                        onClick={() => {
                          const [year, monthValue] = month
                            .split("-")
                            .map((item) => Number(item));
                          if (!year || !monthValue) return;
                          const next = new Date(year, monthValue, 1);
                          setMonth(toLocalMonthValue(next));
                        }}
                      >
                        Try another month
                      </Button>
                    </div>
                  ) : null}
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
                        const first =
                          availability?.byDay[selectedDay]?.[0] ?? null;
                        setSelectedSlot(first);
                      }
                      setScheduleSubStep("time");
                    }}
                  >
                    Continue to time
                  </Button>
                </div>
              </div>
            ) : null}

            {scheduleSubStep === "time" && selectedDay ? (
              <div className="mt-6">
                <h3 className="mb-2 text-sm font-medium text-foreground">
                  Available time slots
                </h3>
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
            ) : null}

            {scheduleSubStep === "time" && selectedDay ? (
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
            ) : null}
          </>
        )}

        {error ? (
          <p className="mt-4 text-base text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {availabilityError ? (
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
        ) : null}
      </div>
    );
  } else {
    content = (
      <div className="mx-auto max-w-md rounded-[28px] border border-border/70 bg-background/92 px-4 py-5 shadow-sm sm:px-6 sm:py-8">
        {renderWizardProgress()}
        <h2 className="text-center text-2xl font-semibold text-foreground">
          Share your details
        </h2>
        <p className="mt-2 text-center text-base text-muted-foreground">
          Fill out once. We will remember details on this device.
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
              Mobile{" "}
              <span className="text-destructive">(Required for booking OTP)</span>
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

          {fields.length > 0 ? (
            <div className="space-y-2">
              {fields.map((f) => (
                <div key={f.key}>
                  <Label
                    htmlFor={`intake-field-${f.key}`}
                    className="mb-0.5 block text-xs text-muted-foreground"
                  >
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
                <Label
                  htmlFor="intake-notes"
                  className="mb-0.5 block text-xs text-muted-foreground"
                >
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
          ) : (
            <div>
              <Label htmlFor="intake-notes" className="mb-1 block">
                Additional notes{" "}
                <span className="text-muted-foreground">(Optional)</span>
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

          {error ? (
            <p className="text-base text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            className="min-h-[44px] w-full"
            disabled={submitting}
          >
            {submitting ? "Saving…" : "Continue to booking"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div
      style={brandVars}
      className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(15,118,110,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))]"
    >
      <style>{`
        @keyframes brand-fade-slide-in {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .brand-stagger {
          animation: brand-fade-slide-in 280ms cubic-bezier(0.23, 1, 0.32, 1)
            both;
        }

        @media (prefers-reduced-motion: reduce) {
          .brand-stagger {
            animation: none !important;
            transform: none !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-4xl px-3 py-6 sm:px-4 sm:py-16">
        {configLoading ? <BrandHeaderSkeleton /> : null}
        {!configLoading && business ? <BrandHeader business={business} /> : null}
        <div className="mt-4 sm:mt-6">{content}</div>
      </div>
    </div>
  );
}
