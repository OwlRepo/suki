"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Send,
  UserPlus,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DatePicker,
  DateTimePicker,
  MonthPicker,
} from "@/components/ui/date-pickers";
import { AvailabilityCalendar } from "@/components/ui/availability-calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { StatusBanner } from "@/components/ui/status-banner";
import { useWorkspace } from "@/contexts/workspace-context";
import { recordOnboardingEvent } from "@/lib/onboarding-metrics";
import { fromError } from "@/lib/ui-feedback";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { normalizeBookingError } from "./booking-flow";
import {
  PH_MOBILE_E164_ERROR,
  PH_MOBILE_E164_PLACEHOLDER,
  normalizePhilippineMobileE164,
} from "@suki/types";

interface Customer {
  id: string;
  name: string;
  mobile?: string | null;
}

type AppointmentStatus =
  | "scheduled"
  | "checked_in"
  | "needs_review"
  | "completed"
  | "missed"
  | "cancelled";

interface Appointment {
  id: string;
  customerId: string;
  businessId: string;
  scheduledAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  checkedInAt?: string | null;
  needsReviewAt?: string | null;
  completedAt?: string | null;
  visitRecordedAt?: string | null;
  notes?: string | null;
  createdAt: string;
}

interface Availability {
  month: string;
  slotDurationMins: number;
  byDay: Record<string, string[]>;
}

type LoadState = "idle" | "loading" | "success" | "error";

type LoadOptions = {
  preserveExisting?: boolean;
  rethrow?: boolean;
};

type PendingAppointmentAction =
  | "arrive"
  | "complete"
  | "missed"
  | "cancel"
  | "reschedule";

function monthKey(iso: string): string {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function dayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function localDateTimeValue(iso: string): string {
  const date = new Date(iso);
  return `${dayKey(iso)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function buildMonthCells(month: string): string[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }).map((_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return dayKey(date.toISOString());
  });
}

function AppointmentsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const newEntry = searchParams?.get("new");
  const rescheduleEntry = searchParams?.get("reschedule");
  const { getToken } = useAuth();
  const { data: syncData } = useAuthSync();
  const workspace = useWorkspace();

  const orgId = syncData?.organization?.id ?? null;
  const selectedBiz = workspace?.activeBusinessId ?? "";
  const businesses = workspace?.businesses ?? [];

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [needsReviewAppointments, setNeedsReviewAppointments] = useState<
    Appointment[]
  >([]);
  const [syncReady, setSyncReady] = useState(false);
  const [appointmentsLoadState, setAppointmentsLoadState] =
    useState<LoadState>("idle");
  const [appointmentsLoadError, setAppointmentsLoadError] =
    useState<string | null>(null);
  const [needsReviewLoadState, setNeedsReviewLoadState] =
    useState<LoadState>("idle");
  const [needsReviewLoadError, setNeedsReviewLoadError] =
    useState<string | null>(null);
  const [customersLoadState, setCustomersLoadState] =
    useState<LoadState>("idle");
  const [customersLoadError, setCustomersLoadError] =
    useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entryMode, setEntryMode] = useState<"existing" | "new">("existing");
  const [showCalendar, setShowCalendar] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const submitPending = useRef(false);
  const resolvedCustomerId = useRef<string | null>(null);
  const openedEntry = useRef<string | null>(null);
  const activeEntryParameter = useRef<"new" | "reschedule" | null>(null);

  const [formData, setFormData] = useState({
    customerId: "",
    scheduledAt: "",
    notes: "",
    remindersOn: true,
  });

  const [calendarMonth, setCalendarMonth] = useState(
    monthKey(new Date().toISOString()),
  );
  const [selectedAgendaDay, setSelectedAgendaDay] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(
    null,
  );
  const [pendingAppointmentAction, setPendingAppointmentAction] = useState<{
    id: string;
    action: PendingAppointmentAction;
  } | null>(null);

  const [newCustomer, setNewCustomer] = useState({
    name: "",
    mobile: "",
    email: "",
    notes: "",
  });

  const [month, setMonth] = useState(monthKey(new Date().toISOString()));
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityRetryNonce, setAvailabilityRetryNonce] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [pendingCancel, setPendingCancel] = useState<{
    id: string;
    customerName: string;
  } | null>(null);

  const isAppointmentActionPending = (
    id: string,
    action?: PendingAppointmentAction,
  ) =>
    pendingAppointmentAction?.id === id &&
    (!action || pendingAppointmentAction.action === action);

  const loadCustomers = async (options?: LoadOptions) => {
    if (!selectedBiz) return;

    const token = await getToken();
    if (!token) return;

    if (!options?.preserveExisting) {
      setCustomers([]);
    }

    setCustomersLoadState("loading");
    setCustomersLoadError(null);

    try {
      const response = await apiRequest<{ customers: Customer[] }>(
        `/customers?businessId=${selectedBiz}&limit=500`,
        { token },
      );

      setCustomers(response.customers);
      setCustomersLoadState("success");
    } catch (loadError) {
      setCustomersLoadState("error");
      setCustomersLoadError(
        fromError(loadError, "Failed to load customers."),
      );
      if (options?.rethrow) throw loadError;
    }
  };

  const loadAppointments = async (options?: LoadOptions) => {
    if (!selectedBiz) return;

    const token = await getToken();
    if (!token) return;

    if (!options?.preserveExisting) {
      setAppointments([]);
      setSelectedAgendaDay(null);
    }

    setAppointmentsLoadState("loading");
    setAppointmentsLoadError(null);

    try {
      const [year, monthNumber] = calendarMonth.split("-").map(Number);
      const from = new Date(year, monthNumber - 1, 1);
      const to = new Date(year, monthNumber, 0, 23, 59, 59, 999);

      let url = `/appointments?businessId=${selectedBiz}`;
      url += `&from=${from.toISOString()}`;
      url += `&to=${to.toISOString()}`;

      const response = await apiRequest<{ appointments: Appointment[] }>(url, {
        token,
      });

      setAppointments(response.appointments.filter((appointment) => appointment.businessId === selectedBiz));
      setAppointmentsLoadState("success");

      const firstDay =
        response.appointments
          .map((appointment) => dayKey(appointment.scheduledAt))
          .sort()[0] ?? null;

      setSelectedAgendaDay((previous) =>
        previous &&
        response.appointments.some(
          (appointment) => dayKey(appointment.scheduledAt) === previous,
        )
          ? previous
          : firstDay,
      );
    } catch (loadError) {
      setAppointmentsLoadState("error");
      setAppointmentsLoadError("Failed to load appointments.");
      if (options?.rethrow) throw loadError;
    }
  };

  const loadNeedsReview = async (options?: LoadOptions) => {
    if (!selectedBiz) return;

    const token = await getToken();
    if (!token) return;

    if (!options?.preserveExisting) {
      setNeedsReviewAppointments([]);
    }

    setNeedsReviewLoadState("loading");
    setNeedsReviewLoadError(null);

    try {
      const response = await apiRequest<{ appointments: Appointment[] }>(
        `/appointments/needs-review?businessId=${selectedBiz}`,
        { token },
      );

      setNeedsReviewAppointments(response.appointments);
      setNeedsReviewLoadState("success");
    } catch (loadError) {
      setNeedsReviewLoadState("error");
      setNeedsReviewLoadError("Failed to load appointments that need review.");

      if (options?.rethrow) throw loadError;
    }
  };

  useEffect(() => {
    if (!syncData) return;
    setSyncReady(true);
  }, [syncData]);

  useEffect(() => {
    setCustomers([]);
    setAppointments([]);
    setNeedsReviewAppointments([]);
    setSelectedAgendaDay(null);
    setShowForm(false);
    setEditingId(null);
    setFormData({ customerId: "", scheduledAt: "", notes: "", remindersOn: true });
    resolvedCustomerId.current = null;
    openedEntry.current = null;
    if (!selectedBiz) return;

    void Promise.all([
      loadCustomers(),
      loadAppointments(),
      loadNeedsReview(),
    ]);
  }, [selectedBiz]);

  useEffect(() => {
    if (!selectedBiz) return;
    void loadAppointments();
  }, [calendarMonth]);

  useEffect(() => {
    if (!showForm || !selectedBiz || editingId) return;
    let cancelled = false;
    setAvailability(null);
    setSelectedDay(null);
    setFormData((previous) => ({ ...previous, scheduledAt: "" }));
    setAvailabilityLoading(true);
    setAvailabilityError(null);

    const run = async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Sign in again to load available times.");
        const data = await apiRequest<Availability>(
          `/appointments/booking/availability?businessId=${selectedBiz}&month=${month}`,
          { token },
        );
        if (cancelled) return;
        setAvailability(data);
        const day = Object.keys(data.byDay ?? {}).filter((key) => data.byDay[key]?.length).sort()[0] ?? null;
        setSelectedDay(day);
        setFormData((previous) => ({ ...previous, scheduledAt: day ? data.byDay[day]?.[0] ?? "" : "" }));
      } catch (loadError) {
        if (!cancelled) setAvailabilityError(fromError(loadError, "Failed to load availability."));
      } finally {
        if (!cancelled) setAvailabilityLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [showForm, selectedBiz, editingId, month, availabilityRetryNonce, getToken]);

  const consumeEntryParameter = () => {
    const parameter = activeEntryParameter.current;
    if (!parameter) return;
    const remaining = new URLSearchParams(searchParams?.toString() ?? "");
    remaining.delete(parameter);
    const query = remaining.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}${window.location.hash}`, { scroll: false });
    activeEntryParameter.current = null;
  };

  const resetForm = () => {
    setFormData({ customerId: "", scheduledAt: "", notes: "", remindersOn: true });
    setEditingId(null);
    setShowForm(false);
    setError(null);
    setEntryMode("existing");
    setNewCustomer({ name: "", mobile: "", email: "", notes: "" });
    resolvedCustomerId.current = null;
    setAvailability(null);
    setAvailabilityError(null);
    setSelectedDay(null);
    setMonth(calendarMonth);
    consumeEntryParameter();
  };

  const handleEdit = (appointment: Appointment) => {
    setEditingId(appointment.id);
    setError(null);
    setFormData({
      customerId: appointment.customerId,
      scheduledAt: localDateTimeValue(appointment.scheduledAt),
      notes: appointment.notes ?? "",
      remindersOn: true,
    });
    setShowForm(true);
  };

  useEffect(() => {
    const entry = newEntry === "1" ? "new" : rescheduleEntry ? `reschedule:${rescheduleEntry}` : null;
    if (!entry) { openedEntry.current = null; return; }
    if (!selectedBiz) return;
    const key = `${selectedBiz}:${entry}`;
    if (openedEntry.current === key) return;
    if (newEntry === "1") {
      openedEntry.current = key;
      activeEntryParameter.current = "new";
      setEditingId(null);
      setShowForm(true);
      return;
    }
    if (appointmentsLoadState !== "success") return;
    const appointment = appointments.find((item) => item.id === rescheduleEntry && item.businessId === selectedBiz);
    if (!appointment || !["scheduled", "needs_review"].includes(appointment.status)) {
      setFeedback({ type: "error", message: "This appointment is not available to reschedule in the selected business and month. Choose its month or retry loading appointments." });
      return;
    }
    openedEntry.current = key;
    activeEntryParameter.current = "reschedule";
    handleEdit(appointment);
  }, [newEntry, rescheduleEntry, selectedBiz, appointmentsLoadState, appointments]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitPending.current) return;
    setError(null);
    if (!selectedBiz) { setError("Choose a business first."); return; }
    if (!editingId && entryMode === "new") {
      if (!newCustomer.name.trim()) { setError("Customer name is required."); return; }
      if (newCustomer.mobile.trim() && !normalizePhilippineMobileE164(newCustomer.mobile)) { setError(PH_MOBILE_E164_ERROR); return; }
    } else if (!formData.customerId) { setError("Select or create a customer first."); return; }
    if (!formData.scheduledAt || (!editingId && (!selectedDay || !availability?.byDay[selectedDay]?.includes(formData.scheduledAt)))) {
      setError("Choose an available appointment time.");
      return;
    }
    submitPending.current = true;
    setSubmitting(true);
    const savedEditingId = editingId;
    if (savedEditingId) setPendingAppointmentAction({ id: savedEditingId, action: "reschedule" });

    try {
      const token = await getToken();
      if (!token) throw new Error("Sign in again before saving the appointment.");
      let customerId = formData.customerId;
      if (!savedEditingId && entryMode === "new") {
        if (!resolvedCustomerId.current) {
          const response = await apiRequest<{ customer: { id: string } }>("/customers/resolve-for-booking", {
            method: "POST", token,
            body: JSON.stringify({
              businessId: selectedBiz, name: newCustomer.name.trim(),
              mobile: newCustomer.mobile.trim() ? normalizePhilippineMobileE164(newCustomer.mobile) : undefined,
              email: newCustomer.email.trim() || undefined, notes: newCustomer.notes.trim() || undefined,
            }),
          });
          // Keep the resolved identity when a booking retry follows a failed save.
          resolvedCustomerId.current = response.customer.id;
        }
        customerId = resolvedCustomerId.current;
      }
      const body = { scheduledAt: new Date(formData.scheduledAt).toISOString(), notes: formData.notes.trim() || undefined };
      await apiRequest(savedEditingId ? `/appointments/${savedEditingId}` : "/appointments", {
        method: savedEditingId ? "PATCH" : "POST", token,
        body: JSON.stringify(savedEditingId ? body : { businessId: selectedBiz, customerId, ...body }),
      });
      resetForm();
      if (!savedEditingId) recordOnboardingEvent("appointment_created", orgId);
      const refreshResults = await Promise.allSettled([
        loadAppointments({ preserveExisting: true, rethrow: true }),
        loadNeedsReview({ preserveExisting: true, rethrow: true }),
        loadCustomers({ preserveExisting: true, rethrow: true }),
      ]);
      const refreshFailed = refreshResults.some((result) => result.status === "rejected");
      setFeedback({
        type: refreshFailed ? "error" : "success",
        message: refreshFailed ? "The update was saved, but the list could not refresh. Retry." : savedEditingId ? "Appointment rescheduled." : "Appointment booked successfully.",
      });
    } catch (saveError) {
      setError(normalizeBookingError(fromError(saveError, "Failed to save appointment. Please try again.")));
    } finally {
      submitPending.current = false;
      setSubmitting(false);
      setPendingAppointmentAction(null);
    }
  };

  const handleStatus = async (
    id: string,
    status: "scheduled" | "completed" | "missed" | "cancelled",
  ) => {
    const action: PendingAppointmentAction =
      status === "completed"
        ? "complete"
        : status === "missed"
          ? "missed"
          : status === "cancelled"
            ? "cancel"
            : "reschedule";
    setPendingAppointmentAction({ id, action });

    try {
      const token = await getToken();
      if (!token) return;

      await apiRequest(`/appointments/${id}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });

      const refreshResults = await Promise.allSettled([
        loadAppointments({ preserveExisting: true, rethrow: true }),
        loadNeedsReview({ preserveExisting: true, rethrow: true }),
      ]);
      const refreshFailed = refreshResults.some(
        (result) => result.status === "rejected",
      );

      const successMessage =
        status === "completed"
          ? "Visit completed and recorded."
          : status === "missed"
            ? "Appointment marked as missed."
            : status === "cancelled"
              ? "Appointment cancelled."
              : "Status updated.";

      setFeedback({
        type: refreshFailed ? "error" : "success",
        message: refreshFailed
          ? "The update was saved, but the list could not refresh. Retry."
          : successMessage,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (statusError) {
      setFeedback({
        type: "error",
        message: fromError(
          statusError,
          "Failed to update status. Please try again.",
        ),
      });
    } finally {
      setPendingAppointmentAction(null);
    }
  };

  const handleArrived = async (id: string) => {
    setPendingAppointmentAction({ id, action: "arrive" });

    try {
      const token = await getToken();
      if (!token) return;

      await apiRequest(`/appointments/${id}/arrive`, {
        method: "PATCH",
        token,
      });

      const refreshResults = await Promise.allSettled([
        loadAppointments({ preserveExisting: true, rethrow: true }),
        loadNeedsReview({ preserveExisting: true, rethrow: true }),
      ]);

      const refreshFailed = refreshResults.some(
        (result) => result.status === "rejected",
      );

      setFeedback({
        type: refreshFailed ? "error" : "success",
        message: refreshFailed
          ? "Customer was marked as arrived, but the list could not refresh. Retry."
          : "Customer marked as arrived. The visit will complete automatically.",
      });

      setTimeout(() => setFeedback(null), 3000);
    } catch (arriveError) {
      setFeedback({
        type: "error",
        message: "Failed to mark the customer as arrived. Please try again.",
      });
    } finally {
      setPendingAppointmentAction(null);
    }
  };

  const handleReminderSent = async (id: string) => {
    try {
      const token = await getToken();
      if (!token) return;

      await apiRequest(`/appointments/${id}/reminder-sent`, {
        method: "PATCH",
        token,
      });

      void loadAppointments({ preserveExisting: true });

      setFeedback({
        type: "success",
        message: "Reminder marked as sent.",
      });

      setTimeout(() => setFeedback(null), 3000);
    } catch (reminderError) {
      setFeedback({
        type: "error",
        message: fromError(
          reminderError,
          "Failed to mark reminder. Please try again.",
        ),
      });
    }
  };

  const getCustomerName = (customerId: string) =>
    customers.find((customer) => customer.id === customerId)?.name ?? "—";

  const calendarCells = buildMonthCells(calendarMonth);

  const appointmentsForMonth = appointments.filter(
    (appointment) => monthKey(appointment.scheduledAt) === calendarMonth,
  );

  const appointmentsByDay = appointmentsForMonth.reduce<
    Record<string, Appointment[]>
  >((accumulator, appointment) => {
    const key = dayKey(appointment.scheduledAt);
    accumulator[key] ??= [];
    accumulator[key].push(appointment);
    return accumulator;
  }, {});

  const agenda = (customerSearch.trim() ? appointmentsForMonth : selectedAgendaDay ? (appointmentsByDay[selectedAgendaDay] ?? []) : [])
        .filter((appointment) => !customerSearch.trim() || getCustomerName(appointment.customerId).toLowerCase().includes(customerSearch.trim().toLowerCase()))
        .filter(
          (appointment) =>
            appointment.status !== "needs_review" ||
            !needsReviewAppointments.some(
              (reviewAppointment) => reviewAppointment.id === appointment.id,
            ),
        )
        .slice()
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  const monthLabel = useMemo(() => {
    const [year, monthNumber] = calendarMonth.split("-").map(Number);

    return new Date(year, monthNumber - 1, 1).toLocaleDateString([], {
      month: "long",
      year: "numeric",
    });
  }, [calendarMonth]);

  if (!workspace?.loading && !businesses.length) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Appointments"
          plainLanguageDescription="Appointments are your daily workspace."
          whatThisPageIsFor="Mark a customer as Arrived once. Suki records the visit automatically after the appointment."
          whatToDoNext="Create a business in Setup first, then add customers and appointments."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 sm:space-y-6">
      <PageHeader
        title="Appointments"
        plainLanguageDescription="Find a customer, manage the day, or book a time."
        actions={<Button disabled={submitting} onClick={() => { resetForm(); setShowForm(true); }} className="w-full gap-2 sm:w-auto"><PlusCircle className="size-4" aria-hidden />New appointment</Button>}
      />
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-40 flex-1 space-y-2"><Label htmlFor="appointment-search">Find appointments</Label><Input id="appointment-search" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search customer name this month" /></div>
        <div className="space-y-2"><Label>Month</Label><MonthPicker value={calendarMonth} onChange={setCalendarMonth} className="w-full sm:w-44" /></div>
        <div className="space-y-2"><Label>Day</Label><DatePicker value={selectedAgendaDay ?? ""} onChange={(value) => { setSelectedAgendaDay(value); setCalendarMonth(value.slice(0, 7)); setCustomerSearch(""); }} placeholder="Pick day" aria-label="Focus day" /></div>
        <Button type="button" variant="outline" aria-pressed={showCalendar} onClick={() => setShowCalendar((previous) => !previous)}><CalendarDays className="size-4" aria-hidden />{showCalendar ? "Hide calendar" : "Calendar view"}</Button>
      </div>

      {feedback ? (
        <StatusBanner
          variant={feedback.type}
          message={<span className="flex flex-wrap items-center gap-2">{feedback.message}{feedback.type === "error" && rescheduleEntry ? <Button type="button" size="sm" variant="outline" onClick={() => void loadAppointments({ preserveExisting: true })}>Retry</Button> : null}</span>}
          onDismiss={() => setFeedback(null)}
        />
      ) : null}

      {appointmentsLoadState === "error" && appointmentsLoadError ? (
        <StatusBanner
          variant="error"
          message={
            <span className="flex flex-wrap items-center gap-2">
              <span>{appointmentsLoadError}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadAppointments({ preserveExisting: true })}
              >
                Retry
              </Button>
            </span>
          }
          onDismiss={() => setAppointmentsLoadError(null)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingCancel)}
        onOpenChange={(open) => !open && setPendingCancel(null)}
        title="Cancel this appointment?"
        description={
          pendingCancel
            ? `This will mark the appointment for ${pendingCancel.customerName} as cancelled. You can still see it in the list.`
            : ""
        }
        confirmLabel="Yes, cancel"
        cancelLabel="No, keep it"
        destructive
        loading={
          pendingCancel
            ? isAppointmentActionPending(pendingCancel.id, "cancel")
            : false
        }
        onConfirm={async () => {
          if (pendingCancel) {
            await handleStatus(pendingCancel.id, "cancelled");
          }
        }}
      />

      {showForm ? (
        <section className="rounded-xl border border-border bg-card p-4 sm:p-6" aria-labelledby="booking-form-title">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="booking-form-title" className="text-lg font-semibold text-foreground">
                  {editingId ? "Reschedule appointment" : "Book appointment"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {editingId ? `Update ${getCustomerName(formData.customerId)}’s appointment.` : "Customer, date, and time together. Save when ready."}
                </p>
              </div>
              <Button type="button" variant="ghost" onClick={resetForm} disabled={submitting}>Cancel</Button>
            </div>

            {editingId ? (
              <div className="max-w-md space-y-2">
                <Label>Date &amp; time</Label>
                <DateTimePicker key={editingId} value={formData.scheduledAt} onChange={(value) => setFormData((previous) => ({ ...previous, scheduledAt: value }))} aria-label="Reschedule date and time" />
              </div>
            ) : (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <div className="min-w-0 space-y-4">
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Customer type">
                    <Button type="button" variant={entryMode === "existing" ? "default" : "outline"} aria-pressed={entryMode === "existing"} onClick={() => setEntryMode("existing")} disabled={submitting}>Existing customer</Button>
                    <Button type="button" variant={entryMode === "new" ? "default" : "outline"} aria-pressed={entryMode === "new"} onClick={() => setEntryMode("new")} disabled={submitting}><UserPlus className="size-4" aria-hidden />New customer</Button>
                  </div>
                  {entryMode === "existing" ? (
                    <div className="space-y-2">
                      <Label htmlFor="booking-customer">Customer</Label>
                      <Select value={formData.customerId || "__none__"} disabled={customersLoadState === "loading" || submitting} onValueChange={(value) => setFormData((previous) => ({ ...previous, customerId: value === "__none__" ? "" : value }))}>
                        <SelectTrigger id="booking-customer" className="min-h-11"><SelectValue placeholder="Select customer" /></SelectTrigger>
                        <SelectContent><SelectItem value="__none__">Select customer</SelectItem>{customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>)}</SelectContent>
                      </Select>
                      {customersLoadState === "loading" ? <p className="text-sm text-muted-foreground">Loading saved customers...</p> : null}
                      {customersLoadState === "error" ? <StatusBanner variant="error" message={<span className="flex flex-wrap items-center gap-2">{customersLoadError ?? "Failed to load customers."}<Button type="button" size="sm" variant="outline" onClick={() => void loadCustomers()}>Retry</Button></span>} /> : null}
                      {customersLoadState === "success" && customers.length === 0 ? <p className="text-sm text-muted-foreground">No saved customers yet. Create a new customer while booking this appointment.</p> : null}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-2"><Label htmlFor="booking-name">Customer name</Label><Input id="booking-name" placeholder="Customer name" value={newCustomer.name} disabled={submitting} onChange={(event) => { resolvedCustomerId.current = null; setNewCustomer((previous) => ({ ...previous, name: event.target.value })); }} /></div>
                      <div className="space-y-2"><Label htmlFor="booking-mobile">Mobile <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="booking-mobile" type="tel" placeholder={PH_MOBILE_E164_PLACEHOLDER} value={newCustomer.mobile} disabled={submitting} onChange={(event) => { resolvedCustomerId.current = null; setNewCustomer((previous) => ({ ...previous, mobile: event.target.value })); }} /><p className="text-xs text-muted-foreground">{PH_MOBILE_E164_ERROR}</p></div>
                      <div className="space-y-2"><Label htmlFor="booking-email">Email <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="booking-email" type="email" placeholder="Email (optional)" value={newCustomer.email} disabled={submitting} onChange={(event) => { resolvedCustomerId.current = null; setNewCustomer((previous) => ({ ...previous, email: event.target.value })); }} /></div>
                      <div className="space-y-2"><Label htmlFor="booking-customer-notes">Customer notes <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea id="booking-customer-notes" placeholder="Customer notes (optional)" value={newCustomer.notes} disabled={submitting} onChange={(event) => { resolvedCustomerId.current = null; setNewCustomer((previous) => ({ ...previous, notes: event.target.value })); }} /></div>
                    </div>
                  )}
                </div>
                <div className="min-w-0 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-medium">Available days</h3><MonthPicker value={month} onChange={setMonth} className="w-full sm:w-44" /></div>
                  {availabilityLoading ? <p role="status" className="text-sm text-muted-foreground">Loading available slots...</p> : availabilityError ? (
                    <StatusBanner variant="error" message={<span className="flex flex-wrap items-center gap-2">{availabilityError}<Button type="button" size="sm" variant="outline" onClick={() => setAvailabilityRetryNonce((value) => value + 1)}>Retry</Button></span>} />
                  ) : availability && !Object.values(availability.byDay ?? {}).some((slots) => slots.length) ? (
                    <EmptyState what="No available slots for this month." why="Choose another month or review your business schedule." />
                  ) : availability ? (
                    <>
                      <AvailabilityCalendar month={month} selectedDay={selectedDay} availableDays={Object.keys(availability.byDay ?? {}).filter((day) => availability.byDay[day]?.length).sort()} onSelect={(day) => { setSelectedDay(day); setFormData((previous) => ({ ...previous, scheduledAt: availability.byDay[day]?.[0] ?? "" })); }} />
                      <div className="space-y-2"><h3 className="text-sm font-medium">Available times</h3><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{(selectedDay ? availability.byDay[selectedDay] ?? [] : []).map((slot) => <Button key={slot} type="button" variant={formData.scheduledAt === slot ? "default" : "outline"} aria-pressed={formData.scheduledAt === slot} disabled={submitting} onClick={() => setFormData((previous) => ({ ...previous, scheduledAt: slot }))}>{new Date(slot).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Button>)}</div></div>
                    </>
                  ) : null}
                </div>
              </div>
            )}
            <div className="space-y-2"><Label htmlFor="booking-notes">Appointment notes <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="booking-notes" value={formData.notes} onChange={(event) => setFormData((previous) => ({ ...previous, notes: event.target.value }))} disabled={submitting} placeholder="Appointment notes (optional)" /></div>
            {error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">{formData.scheduledAt ? new Date(formData.scheduledAt).toLocaleString() : "Choose an available time."}</p>
              <Button type="submit" disabled={submitting || (!editingId && (availabilityLoading || !availability || !!availabilityError || !formData.scheduledAt))} className="w-full sm:w-auto">{submitting ? "Saving..." : editingId ? "Update appointment" : "Save appointment"}</Button>
            </div>
          </form>
        </section>
      ) : null}

      {needsReviewLoadState === "loading" &&
      needsReviewAppointments.length === 0 ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Loading appointments that need review...
        </p>
      ) : null}

      {needsReviewLoadState === "error" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              {needsReviewLoadError ??
                "Failed to load appointments that need review."}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void loadNeedsReview({ preserveExisting: true })}
            >
              Retry
            </Button>
          </div>
        </div>
      ) : null}

      {needsReviewAppointments.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-bold text-foreground">Needs review</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These appointments passed without an arrival check. Confirm what
            happened.
          </p>

          <ul className="mt-4 space-y-3">
            {needsReviewAppointments.map((appointment) => (
              <li
                key={appointment.id}
                className="rounded-xl border border-amber-200 bg-card p-3"
              >
                <p className="font-semibold text-foreground">
                  {getCustomerName(appointment.customerId)}
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(appointment.scheduledAt).toLocaleString()}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={isAppointmentActionPending(
                      appointment.id,
                      "complete",
                    )}
                    onClick={() => handleStatus(appointment.id, "completed")}
                  >
                    {isAppointmentActionPending(appointment.id, "complete")
                      ? "Completing..."
                      : "Completed"}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isAppointmentActionPending(
                      appointment.id,
                      "missed",
                    )}
                    onClick={() => handleStatus(appointment.id, "missed")}
                  >
                    {isAppointmentActionPending(appointment.id, "missed")
                      ? "Saving..."
                      : "Missed"}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isAppointmentActionPending(
                      appointment.id,
                      "reschedule",
                    )}
                    onClick={() => handleEdit(appointment)}
                  >
                    Reschedule
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}


      <section>
        {!syncReady ||
        workspace?.loading ||
        (Boolean(selectedBiz) &&
          appointmentsLoadState === "loading" &&
          appointments.length === 0) ? (
          <div role="status" aria-label="Loading appointments">
            <ListSkeleton rowCount={5} className="mt-4" />
          </div>
        ) : (
          <>
            <div className={showCalendar ? "grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]" : "space-y-4"}>
              {showCalendar ? <article className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-foreground">
                      Calendar view
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {appointmentsForMonth.length} appointments in this month
                    </p>
                  </div>

                  <div className="hidden items-center gap-2 sm:flex">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const [year, monthNumber] = calendarMonth
                          .split("-")
                          .map(Number);
                        const previous = new Date(year, monthNumber - 2, 1);
                        setCalendarMonth(previous.toISOString().slice(0, 7));
                      }}
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>

                    <span className="min-w-28 text-center text-sm font-medium text-foreground">
                      {monthLabel}
                    </span>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const [year, monthNumber] = calendarMonth
                          .split("-")
                          .map(Number);
                        const next = new Date(year, monthNumber, 1);
                        setCalendarMonth(next.toISOString().slice(0, 7));
                      }}
                      aria-label="Next month"
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground sm:gap-2 sm:text-xs">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (dayName) => (
                      <span key={dayName}>{dayName}</span>
                    ),
                  )}
                </div>

                <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
                  {calendarCells.map((day) => {
                    const dayAppointments = appointmentsByDay[day] ?? [];
                    const inMonth = day.startsWith(calendarMonth);
                    const isSelected = selectedAgendaDay === day;

                    return (
                      <button
                        key={day}
                        type="button"
                        className={`relative min-h-10 rounded-xl border p-1 text-left text-[11px] transition sm:min-h-12 sm:p-2 sm:text-xs ${
                          isSelected
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border bg-card hover:border-primary/25"
                        } ${inMonth ? "" : "opacity-40"}`}
                        onClick={() => setSelectedAgendaDay(day)}
                      >
                        <p className="font-medium">
                          {new Date(`${day}T12:00:00`).getDate()}
                        </p>

                        {dayAppointments.length > 0 ? (
                          <>
                            <span
                              className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary"
                              aria-hidden
                            />

                            {dayAppointments.length > 1 ? (
                              <span className="absolute bottom-1 right-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                {dayAppointments.length}
                              </span>
                            ) : null}
                          </>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-primary" />
                    Has appointments
                  </span>

                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-slate-300" />
                    Other month
                  </span>
                </div>
              </article> : null}

              <article className="rounded-xl border border-border bg-card p-4 sm:p-5">
                <h2 className="text-base font-bold text-foreground">
                  {customerSearch.trim() ? "Search results this month" : "Selected day agenda"}
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  {customerSearch.trim() ? `${agenda.length} matching appointments` : selectedAgendaDay ? new Date(`${selectedAgendaDay}T12:00:00`).toLocaleDateString() : "Choose a day"}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">{appointmentsForMonth.length} appointments in this month</p>
                <ul className="mt-4 space-y-3">
                  {agenda.map((appointment) => {
                    const isNew =
                      Date.now() -
                        new Date(appointment.createdAt).getTime() <
                      1000 * 60 * 60 * 24;

                    return (
                      <li
                        key={appointment.id}
                        className="rounded-2xl border-l-4 border-l-primary border-y border-r border-border bg-card p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-foreground">
                            {getCustomerName(appointment.customerId)}
                          </span>

                          <Badge
                            variant={
                              appointment.status === "cancelled"
                                ? "destructive"
                                : appointment.status === "completed"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="capitalize"
                          >
                            {appointment.status.replace("_", " ")}
                          </Badge>

                          {isNew ? (
                            <Badge className="bg-emerald-600 text-white">
                              New
                            </Badge>
                          ) : null}
                        </div>

                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {customerSearch.trim() ? `${new Date(appointment.scheduledAt).toLocaleDateString()} · ` : ""}
                          {new Date(
                            appointment.scheduledAt,
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {appointment.notes ? ` · ${appointment.notes}` : ""}
                        </p>

                        <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
                          {appointment.status === "scheduled" ? (
                            <>
                              <Button
                                size="sm"
                                disabled={isAppointmentActionPending(
                                  appointment.id,
                                  "arrive",
                                )}
                                onClick={() => handleArrived(appointment.id)}
                              >
                                {isAppointmentActionPending(
                                  appointment.id,
                                  "arrive",
                                )
                                  ? "Marking arrived..."
                                  : "Arrived"}
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleReminderSent(appointment.id)
                                }
                              >
                                <Send className="size-4" />
                                Reminder sent
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isAppointmentActionPending(
                                  appointment.id,
                                  "reschedule",
                                )}
                                onClick={() => handleEdit(appointment)}
                              >
                                <CalendarDays className="size-4" />
                                Reschedule
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isAppointmentActionPending(
                                  appointment.id,
                                  "cancel",
                                )}
                                onClick={() =>
                                  setPendingCancel({
                                    id: appointment.id,
                                    customerName: getCustomerName(
                                      appointment.customerId,
                                    ),
                                  })
                                }
                              >
                                Cancel
                              </Button>
                            </>
                          ) : null}

                          {appointment.status === "checked_in" ? (
                            <>
                              <span className="inline-flex min-h-10 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-700">
                                Arrived · completes automatically
                              </span>

                              <Button
                                size="sm"
                                disabled={isAppointmentActionPending(
                                  appointment.id,
                                  "complete",
                                )}
                                onClick={() =>
                                  handleStatus(appointment.id, "completed")
                                }
                              >
                                {isAppointmentActionPending(
                                  appointment.id,
                                  "complete",
                                )
                                  ? "Completing..."
                                  : "Complete now"}
                              </Button>
                            </>
                          ) : null}

                          {appointment.status === "needs_review" ? (
                            <>
                              <Button
                                size="sm"
                                disabled={isAppointmentActionPending(
                                  appointment.id,
                                  "complete",
                                )}
                                onClick={() =>
                                  handleStatus(appointment.id, "completed")
                                }
                              >
                                Completed
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isAppointmentActionPending(
                                  appointment.id,
                                  "missed",
                                )}
                                onClick={() =>
                                  handleStatus(appointment.id, "missed")
                                }
                              >
                                Missed
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isAppointmentActionPending(
                                  appointment.id,
                                  "reschedule",
                                )}
                                onClick={() => handleEdit(appointment)}
                              >
                                Reschedule
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {agenda.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
                    <EmptyState
                      what="No appointments for this day."
                      why="Create a booking or choose another date."
                    />
                  </div>
                ) : (
                  <div className="mt-4 flex min-h-32 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-4 text-center">
                    <div>
                      <CalendarDays className="mx-auto size-7 text-muted-foreground" />
                      <p className="mt-3 text-sm text-muted-foreground">
                        No more appointments for this day.
                      </p>
                    </div>
                  </div>
                )}
              </article>
            </div>

            {appointments.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  what="No appointments yet"
                  why="Create a booking to start your daily appointment workspace."
                  nextAction={
                    <Button
                      onClick={() => {
                        resetForm();
                        setShowForm(true);
                      }}
                    >
                      Create first appointment
                    </Button>
                  }
                />
              </div>
            ) : null}
          </>
        )}
      </section>


    </div>
  );
}

export default function AppointmentsPage() {
  return <Suspense fallback={<ListSkeleton rowCount={5} />}><AppointmentsPageContent /></Suspense>;
}
