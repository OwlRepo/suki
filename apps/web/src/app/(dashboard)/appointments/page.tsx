"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
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
import { PrimaryPageAction } from "@/components/ui/primary-page-action";
import { useWorkspace } from "@/contexts/workspace-context";
import { recordOnboardingEvent } from "@/lib/onboarding-metrics";
import { fromError } from "@/lib/ui-feedback";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  buildAppointmentWizardSteps,
  type BookingStep,
} from "./wizard-progress";
import { normalizeBookingError } from "./booking-flow";
import {
  PH_MOBILE_E164_ERROR,
  PH_MOBILE_E164_PLACEHOLDER,
  normalizePhilippineMobileE164,
} from "@tyvera/types";

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
  return new Date(iso).toISOString().slice(0, 10);
}

function buildMonthCells(month: string): string[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }).map((_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

function AppointmentsPageContent() {
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
  const [step, setStep] = useState<BookingStep>("customer");
  const [entryMode, setEntryMode] = useState<"existing" | "new">("existing");

  const [formData, setFormData] = useState({
    customerId: "",
    scheduledAt: "",
    notes: "",
    remindersOn: true,
  });

  const [calendarMonth, setCalendarMonth] = useState(
    new Date().toISOString().slice(0, 7),
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

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
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

      setAppointments(response.appointments);
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
    if (!showForm || !selectedBiz) return;
    if (step !== "date" && step !== "time") return;

    const run = async () => {
      const token = await getToken();
      if (!token) return;

      setAvailabilityLoading(true);
      setAvailabilityError(null);

      try {
        const data = await apiRequest<Availability>(
          `/appointments/booking/availability?businessId=${selectedBiz}&month=${month}`,
          { token },
        );

        setAvailability(data);

        const day = Object.keys(data.byDay ?? {}).sort()[0] ?? null;
        setSelectedDay(day);

        const slot = day ? data.byDay[day]?.[0] ?? "" : "";

        setFormData((previous) => ({
          ...previous,
          scheduledAt: slot ? slot.slice(0, 16) : previous.scheduledAt,
        }));
      } catch (loadError) {
        setAvailabilityError(fromError(loadError, "Failed to load availability."));
      } finally {
        setAvailabilityLoading(false);
      }
    };

    void run();
  }, [showForm, selectedBiz, step, month, availabilityRetryNonce]);

  const resetForm = () => {
    const defaultTime = new Date();
    defaultTime.setHours(14, 0, 0, 0);

    setFormData({
      customerId: "",
      scheduledAt: defaultTime.toISOString().slice(0, 16),
      notes: "",
      remindersOn: true,
    });

    setEditingId(null);
    setShowForm(false);
    setError(null);
    setStep("customer");
    setEntryMode("existing");
    setNewCustomer({ name: "", mobile: "", email: "", notes: "" });
    setAvailability(null);
    setAvailabilityError(null);
    setSelectedDay(null);
  };

  const handleEdit = (appointment: Appointment) => {
    setEditingId(appointment.id);

    setFormData({
      customerId: appointment.customerId,
      scheduledAt: appointment.scheduledAt.slice(0, 16),
      notes: appointment.notes ?? "",
      remindersOn: true,
    });

    setShowForm(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedBiz || !formData.customerId || !formData.scheduledAt) return;

    setSubmitting(true);
    if (editingId) {
      setPendingAppointmentAction({ id: editingId, action: "reschedule" });
    }
    setError(null);

    try {
      const token = await getToken();
      if (!token) return;

      const body = {
        customerId: formData.customerId,
        scheduledAt: new Date(formData.scheduledAt).toISOString(),
        notes: formData.notes || undefined,
      };

      if (editingId) {
        await apiRequest(`/appointments/${editingId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify({
            scheduledAt: body.scheduledAt,
            notes: body.notes,
          }),
        });
      } else {
        await apiRequest("/appointments", {
          method: "POST",
          token,
          body: JSON.stringify({ businessId: selectedBiz, ...body }),
        });
      }

      resetForm();

      if (!editingId) {
        recordOnboardingEvent("appointment_created", orgId);
      }

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
          ? "The update was saved, but the list could not refresh. Retry."
          : editingId
            ? "Appointment rescheduled."
            : "Appointment created.",
      });

      setTimeout(() => setFeedback(null), 3000);
    } catch (saveError) {
      setError(
        fromError(saveError, "Failed to save appointment. Please try again."),
      );
    } finally {
      setSubmitting(false);
      setPendingAppointmentAction(null);
    }
  };

  const ensureCustomerForWizard = async () => {
    const token = await getToken();
    if (!token || !selectedBiz) return null;

    if (entryMode === "existing") {
      return formData.customerId || null;
    }

    if (!newCustomer.name.trim()) {
      throw new Error("Customer name is required.");
    }

    const normalizedMobile = newCustomer.mobile.trim()
      ? normalizePhilippineMobileE164(newCustomer.mobile)
      : undefined;

    if (newCustomer.mobile.trim() && !normalizedMobile) {
      throw new Error(PH_MOBILE_E164_ERROR);
    }

    const response = await apiRequest<{ customer: { id: string } }>(
      "/customers/resolve-for-booking",
      {
        method: "POST",
        token,
        body: JSON.stringify({
          businessId: selectedBiz,
          name: newCustomer.name.trim(),
          mobile: normalizedMobile,
          email: newCustomer.email.trim() || undefined,
          notes: newCustomer.notes.trim() || undefined,
        }),
      },
    );

    await loadCustomers({ preserveExisting: true });

    setFormData((previous) => ({
      ...previous,
      customerId: response.customer.id,
    }));

    return response.customer.id;
  };

  const validateCustomerStep = () => {
    if (entryMode === "existing") return true;

    if (!newCustomer.name.trim()) {
      setError("Customer name is required.");
      return false;
    }

    if (
      newCustomer.mobile.trim() &&
      !normalizePhilippineMobileE164(newCustomer.mobile)
    ) {
      setError(PH_MOBILE_E164_ERROR);
      return false;
    }

    return true;
  };

  const completeWizardBooking = async () => {
    if (!selectedBiz || !formData.scheduledAt) return;

    setSubmitting(true);

    try {
    const customerId = await ensureCustomerForWizard();

    if (!customerId) {
      throw new Error("Select or create a customer first.");
    }

    const token = await getToken();
    if (!token) return;

    await apiRequest("/appointments", {
      method: "POST",
      token,
      body: JSON.stringify({
        businessId: selectedBiz,
        customerId,
        scheduledAt: new Date(formData.scheduledAt).toISOString(),
        notes: formData.notes.trim() || undefined,
      }),
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
        ? "The update was saved, but the list could not refresh. Retry."
        : "Appointment created.",
    });
    setStep("done");
    } finally {
      setSubmitting(false);
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

  const agenda = selectedAgendaDay
    ? (appointmentsByDay[selectedAgendaDay] ?? [])
        .filter(
          (appointment) =>
            appointment.status !== "needs_review" ||
            !needsReviewAppointments.some(
              (reviewAppointment) => reviewAppointment.id === appointment.id,
            ),
        )
        .slice()
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    : [];

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
          whatThisPageIsFor="Mark a customer as Arrived once. Tyvera records the visit automatically after the appointment."
          whatToDoNext="Create a business in Setup first, then add customers and appointments."
        />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 sm:space-y-8">
      <PageHeader
        title="Appointments"
        plainLanguageDescription="Appointments are your daily workspace."
        whatThisPageIsFor="Mark a customer as Arrived once. Tyvera records the visit automatically after the appointment."
        whatToDoNext={
          appointments.length === 0
            ? "Create your first appointment."
            : "Mark arriving customers as Arrived."
        }
        actions={
          <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <MonthPicker
              value={calendarMonth}
              onChange={setCalendarMonth}
              className="w-full sm:w-44"
            />

            <DatePicker
              value={selectedAgendaDay ?? ""}
              onChange={(value) => {
                setSelectedAgendaDay(value);
                setCalendarMonth(value.slice(0, 7));
              }}
              placeholder="Pick day"
              aria-label="Focus day"
            />
          </div>
        }
      />

      <PrimaryPageAction
        primaryAction={
          <Button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            size="lg"
            className="w-full gap-2 sm:w-auto"
          >
            <PlusCircle className="size-5" />
            {appointments.length === 0
              ? "Create first appointment"
              : "New appointment"}
          </Button>
        }
        hintText="Pick a customer first, then choose a time preset or exact date and time."
      />

      {feedback ? (
        <StatusBanner
          variant={feedback.type}
          message={feedback.message}
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
          <h2 className="text-base font-bold text-slate-950">Needs review</h2>
          <p className="mt-1 text-sm text-slate-600">
            These appointments passed without an arrival check. Confirm what
            happened.
          </p>

          <ul className="mt-4 space-y-3">
            {needsReviewAppointments.map((appointment) => (
              <li
                key={appointment.id}
                className="rounded-xl border border-amber-200 bg-white p-3"
              >
                <p className="font-semibold text-slate-950">
                  {getCustomerName(appointment.customerId)}
                </p>

                <p className="mt-1 text-sm text-slate-600">
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

      {showForm ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          {editingId ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <CalendarDays className="size-5" />
                </span>

                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    Reschedule appointment
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Update the appointment date, time, or notes.
                  </p>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Date &amp; time</Label>
                <DateTimePicker
                  value={formData.scheduledAt}
                  onChange={(value) =>
                    setFormData((previous) => ({
                      ...previous,
                      scheduledAt: value,
                    }))
                  }
                  aria-label="Reschedule date and time"
                />
              </div>

              <div>
                <Label className="mb-2 block">Notes</Label>
                <Input
                  value={formData.notes}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Optional"
                />
              </div>

              {error ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </p>
              ) : null}

              <div className="grid gap-3 sm:flex">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving..." : "Update"}
                </Button>

                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <CalendarPlus className="size-5" />
                </span>

                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    Book appointment
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Follow the steps to create a visit.
                  </p>
                </div>
              </div>

              <ol className="mt-5 grid gap-3 sm:grid-cols-4">
                {buildAppointmentWizardSteps(step).map((wizardStep, index) => (
                  <li
                    key={wizardStep.id}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-sm ${
                      wizardStep.state === "active"
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    <span
                      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        wizardStep.state === "active"
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {index + 1}
                    </span>

                    <span className="capitalize">{wizardStep.id}</span>
                  </li>
                ))}
              </ol>

              {step === "customer" ? (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-3 sm:flex">
                    <Button
                      type="button"
                      variant={entryMode === "existing" ? "default" : "outline"}
                      onClick={() => setEntryMode("existing")}
                    >
                      Existing customer
                    </Button>

                    <Button
                      type="button"
                      variant={entryMode === "new" ? "default" : "outline"}
                      onClick={() => setEntryMode("new")}
                    >
                      <UserPlus className="size-4" />
                      New customer
                    </Button>
                  </div>

                  {entryMode === "existing" ? (
                    <div>
                      <Label className="mb-2 block">Customer</Label>

                      <Select
                        value={formData.customerId || "__none__"}
                        disabled={customersLoadState === "loading"}
                        onValueChange={(value) =>
                          setFormData((previous) => ({
                            ...previous,
                            customerId: value === "__none__" ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger className="min-h-11">
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>

                        <SelectContent>
                          <SelectItem value="__none__">
                            Select customer
                          </SelectItem>

                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {customersLoadState === "loading" ? (
                        <p className="mt-2 text-sm text-slate-500">
                          Loading saved customers...
                        </p>
                      ) : null}

                      {customersLoadState === "error" ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                          <span>
                            {customersLoadError ?? "Failed to load customers."}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void loadCustomers()}
                          >
                            Retry
                          </Button>
                        </div>
                      ) : null}

                      {customersLoadState === "success" &&
                      customers.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-500">
                          No saved customers yet. Create a new customer while
                          booking this appointment.
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        placeholder="Customer name"
                        value={newCustomer.name}
                        onChange={(event) =>
                          setNewCustomer((previous) => ({
                            ...previous,
                            name: event.target.value,
                          }))
                        }
                      />

                      <div>
                        <Input
                          type="tel"
                          placeholder={PH_MOBILE_E164_PLACEHOLDER}
                          value={newCustomer.mobile}
                          onChange={(event) =>
                            setNewCustomer((previous) => ({
                              ...previous,
                              mobile: event.target.value,
                            }))
                          }
                          aria-label="Mobile"
                        />

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {PH_MOBILE_E164_ERROR}
                        </p>
                      </div>

                      <Input
                        placeholder="Email (optional)"
                        value={newCustomer.email}
                        onChange={(event) =>
                          setNewCustomer((previous) => ({
                            ...previous,
                            email: event.target.value,
                          }))
                        }
                      />

                      <Textarea
                        placeholder="Notes (optional)"
                        value={newCustomer.notes}
                        onChange={(event) =>
                          setNewCustomer((previous) => ({
                            ...previous,
                            notes: event.target.value,
                          }))
                        }
                      />
                    </div>
                  )}
                </div>
              ) : null}

              {step === "date" || step === "time" ? (
                <div className="mt-5 space-y-4">
                  <MonthPicker
                    value={month}
                    onChange={setMonth}
                    className="w-full sm:w-48"
                  />

                  {availabilityLoading ? (
                    <p className="text-sm text-slate-500">
                      Loading available slots...
                    </p>
                  ) : availabilityError ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      <span>{availabilityError}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setAvailabilityRetryNonce((value) => value + 1);
                        }}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : availability &&
                    Object.keys(availability.byDay ?? {}).length === 0 ? (
                    <EmptyState
                      what="No available slots for this month."
                      why="Choose another month or review your business schedule."
                    />
                  ) : (
                    <>
                      {step === "date" ? (
                        <AvailabilityCalendar
                          month={month}
                          selectedDay={selectedDay}
                          availableDays={Object.keys(
                            availability?.byDay ?? {},
                          ).sort()}
                          onSelect={(day) => setSelectedDay(day)}
                        />
                      ) : null}

                      {step === "time" && selectedDay ? (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          {(availability?.byDay[selectedDay] ?? []).map(
                            (slot) => (
                              <Button
                                key={slot}
                                type="button"
                                variant={
                                  formData.scheduledAt === slot.slice(0, 16)
                                    ? "default"
                                    : "outline"
                                }
                                onClick={() =>
                                  setFormData((previous) => ({
                                    ...previous,
                                    scheduledAt: slot.slice(0, 16),
                                  }))
                                }
                              >
                                {new Date(slot).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </Button>
                            ),
                          )}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}

              {step === "review" ? (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                    <p>
                      <span className="font-semibold text-slate-950">
                        Customer:
                      </span>{" "}
                      {entryMode === "existing"
                        ? getCustomerName(formData.customerId)
                        : newCustomer.name || "—"}
                    </p>

                    <p>
                      <span className="font-semibold text-slate-950">
                        Appointment:
                      </span>{" "}
                      {formData.scheduledAt
                        ? new Date(formData.scheduledAt).toLocaleString()
                        : "—"}
                    </p>
                  </div>

                  <Input
                    className="mt-4"
                    placeholder="Notes (optional)"
                    value={formData.notes}
                    onChange={(event) =>
                      setFormData((previous) => ({
                        ...previous,
                        notes: event.target.value,
                      }))
                    }
                  />
                </div>
              ) : null}

              {step === "done" ? (
                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0" />

                  <div>
                    <p className="font-semibold">
                      Appointment booked successfully.
                    </p>
                    <p className="mt-1 text-sm">
                      The new appointment is now visible in the calendar.
                    </p>
                  </div>
                </div>
              ) : null}

              {error ? (
                <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </p>
              ) : null}

              <div className="mt-5 grid gap-3 sm:flex">
                {step !== "done" ? (
                  <Button
                    type="button"
                    disabled={submitting}
                    onClick={async () => {
                      setError(null);

                      try {
                        if (step === "customer") {
                          if (!validateCustomerStep()) return;
                          setStep("date");
                        } else if (step === "date") {
                          setStep("time");
                        } else if (step === "time") {
                          setStep("review");
                        } else if (step === "review") {
                          await completeWizardBooking();
                        }
                      } catch (wizardError) {
                        setError(
                          normalizeBookingError(
                            fromError(wizardError, "Unable to continue."),
                          ),
                        );
                      }
                    }}
                  >
                    {submitting ? "Creating..." : "Continue"}
                  </Button>
                ) : null}

                {step === "done" ? (
                  <Button type="button" onClick={resetForm}>
                    Close
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </>
          )}
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
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-950">
                      Calendar view
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
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

                    <span className="min-w-28 text-center text-sm font-medium text-slate-700">
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

                <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500 sm:gap-2 sm:text-xs">
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
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white hover:border-blue-200"
                        } ${inMonth ? "" : "opacity-40"}`}
                        onClick={() => setSelectedAgendaDay(day)}
                      >
                        <p className="font-medium">
                          {new Date(day).getDate()}
                        </p>

                        {dayAppointments.length > 0 ? (
                          <>
                            <span
                              className="absolute right-1.5 top-1.5 size-2 rounded-full bg-blue-600"
                              aria-hidden
                            />

                            {dayAppointments.length > 1 ? (
                              <span className="absolute bottom-1 right-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                                {dayAppointments.length}
                              </span>
                            ) : null}
                          </>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-blue-600" />
                    Has appointments
                  </span>

                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-slate-300" />
                    Other month
                  </span>
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <h2 className="text-base font-bold text-slate-950">
                  Selected day agenda
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {selectedAgendaDay
                    ? new Date(selectedAgendaDay).toLocaleDateString()
                    : "No day selected"}
                </p>

                <ul className="mt-4 space-y-3">
                  {agenda.map((appointment) => {
                    const isNew =
                      Date.now() -
                        new Date(appointment.createdAt).getTime() <
                      1000 * 60 * 60 * 24;

                    return (
                      <li
                        key={appointment.id}
                        className="rounded-2xl border-l-4 border-l-blue-600 border-y border-r border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-950">
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

                        <p className="mt-2 text-sm leading-6 text-slate-600">
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
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                    <EmptyState
                      what="No appointments for this day."
                      why="Create a booking or choose another date."
                    />
                  </div>
                ) : (
                  <div className="mt-4 flex min-h-32 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center">
                    <div>
                      <CalendarDays className="mx-auto size-7 text-slate-400" />
                      <p className="mt-3 text-sm text-slate-500">
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

      <section className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
            <Info className="size-5" />
          </span>

          <div>
            <p className="font-semibold text-slate-950">
              Tip: Arrived starts automatic visit recording.
            </p>

            <p className="mt-1 text-sm leading-6 text-slate-600">
              Mark the customer once when they arrive. Tyvera completes the
              visit after the expected duration and grace period.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function AppointmentsPage() {
  return <AppointmentsPageContent />;
}
