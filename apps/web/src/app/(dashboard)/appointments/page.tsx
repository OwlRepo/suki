"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DatePicker, DateTimePicker, MonthPicker } from "@/components/ui/date-pickers";
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
import { buildAppointmentWizardSteps, type BookingStep } from "./wizard-progress";
import {
  normalizeBookingError,
} from "./booking-flow";
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

interface Appointment {
  id: string;
  customerId: string;
  businessId: string;
  scheduledAt: string;
  status: string;
  notes?: string | null;
  createdAt: string;
}

interface Availability {
  month: string;
  slotDurationMins: number;
  byDay: Record<string, string[]>;
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function buildMonthCells(month: string): string[] {
  const [year, monthNum] = month.split("-").map(Number);
  const first = new Date(year, monthNum - 1, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }).map((_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d.toISOString().slice(0, 10);
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
  const [syncReady, setSyncReady] = useState(false);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
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
  const [calendarMonth, setCalendarMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedAgendaDay, setSelectedAgendaDay] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCustomer, setNewCustomer] = useState({ name: "", mobile: "", email: "", notes: "" });
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [pendingCancel, setPendingCancel] = useState<{ id: string; customerName: string } | null>(null);

  const loadCustomers = async () => {
    if (!selectedBiz) return;
    const token = await getToken();
    if (!token) return;
    const res = await apiRequest<{ customers: Customer[] }>(
      `/customers?businessId=${selectedBiz}&limit=500`,
      { token },
    );
    setCustomers(res.customers);
  };

  const loadAppointments = async () => {
    if (!selectedBiz) return;
    const token = await getToken();
    if (!token) return;
    setAppointmentsLoading(true);
    try {
      const [y, m] = calendarMonth.split("-").map(Number);
      const from = new Date(y, m - 1, 1);
      const to = new Date(y, m, 0, 23, 59, 59, 999);
      let url = `/appointments?businessId=${selectedBiz}`;
      url += `&from=${from.toISOString()}`;
      url += `&to=${to.toISOString()}`;
      const res = await apiRequest<{ appointments: Appointment[] }>(url, { token });
      setAppointments(res.appointments);
      const firstDay = res.appointments
        .map((a) => dayKey(a.scheduledAt))
        .sort()[0] ?? null;
      setSelectedAgendaDay((prev) => (prev && res.appointments.some((a) => dayKey(a.scheduledAt) === prev) ? prev : firstDay));
    } finally {
      setAppointmentsLoading(false);
    }
  };

  useEffect(() => {
    if (!syncData) return;
    setSyncReady(true);
  }, [syncData]);

  useEffect(() => {
    if (!selectedBiz) return;
    loadCustomers();
  }, [selectedBiz]);

  useEffect(() => {
    if (!selectedBiz) return;
    loadAppointments();
  }, [selectedBiz, calendarMonth]);

  useEffect(() => {
    if (!showForm || !selectedBiz) return;
    if (step !== "date" && step !== "time") return;
    const run = async () => {
      const token = await getToken();
      if (!token) return;
      setAvailabilityLoading(true);
      try {
        const data = await apiRequest<Availability>(
          `/appointments/booking/availability?businessId=${selectedBiz}&month=${month}`,
          { token },
        );
        setAvailability(data);
        const day = Object.keys(data.byDay ?? {}).sort()[0] ?? null;
        setSelectedDay(day);
        const slot = day ? (data.byDay[day]?.[0] ?? "") : "";
        setFormData((prev) => ({ ...prev, scheduledAt: slot ? slot.slice(0, 16) : prev.scheduledAt }));
      } catch (err) {
        setError(fromError(err, "Failed to load availability."));
      } finally {
        setAvailabilityLoading(false);
      }
    };
    void run();
  }, [showForm, selectedBiz, step, month]);

  const resetForm = () => {
    const today = new Date();
    const defaultTime = new Date(today);
    defaultTime.setHours(14, 0, 0, 0); // 2pm default
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
    setSelectedDay(null);
  };

  const handleEdit = (a: Appointment) => {
    setEditingId(a.id);
    setFormData({
      customerId: a.customerId,
      scheduledAt: a.scheduledAt.slice(0, 16),
      notes: a.notes ?? "",
      remindersOn: true,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBiz || !formData.customerId || !formData.scheduledAt) return;
    setSubmitting(true);
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
      loadAppointments();
      setFeedback({ type: "success", message: editingId ? "Appointment updated." : "Appointment created." });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setError(fromError(err, "Failed to save appointment. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const ensureCustomerForWizard = async () => {
    const token = await getToken();
    if (!token || !selectedBiz) return null;
    if (entryMode === "existing") {
      return formData.customerId || null;
    }
    if (!newCustomer.name.trim()) throw new Error("Customer name is required.");
    const normalizedMobile = newCustomer.mobile.trim()
      ? normalizePhilippineMobileE164(newCustomer.mobile)
      : undefined;
    if (newCustomer.mobile.trim() && !normalizedMobile) {
      throw new Error(PH_MOBILE_E164_ERROR);
    }
    const res = await apiRequest<{ customer: { id: string } }>("/customers", {
      method: "POST",
      token,
      body: JSON.stringify({
        businessId: selectedBiz,
        name: newCustomer.name.trim(),
        mobile: normalizedMobile,
        email: newCustomer.email.trim() || undefined,
        notes: newCustomer.notes.trim() || undefined,
      }),
    });
    await loadCustomers();
    setFormData((prev) => ({ ...prev, customerId: res.customer.id }));
    return res.customer.id;
  };

  const validateCustomerStep = () => {
    if (entryMode === "existing") return true;
    if (!newCustomer.name.trim()) {
      setError("Customer name is required.");
      return false;
    }
    if (newCustomer.mobile.trim() && !normalizePhilippineMobileE164(newCustomer.mobile)) {
      setError(PH_MOBILE_E164_ERROR);
      return false;
    }
    return true;
  };

  const completeWizardBooking = async () => {
    if (!selectedBiz || !formData.scheduledAt) return;
    const customerId = await ensureCustomerForWizard();
    if (!customerId) throw new Error("Select or create a customer first.");
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
    await loadAppointments();
    setFeedback({ type: "success", message: "Appointment created." });
    setStep("done");
  };

  const handleStatus = async (id: string, status: "scheduled" | "completed" | "missed" | "cancelled") => {
    try {
      const token = await getToken();
      if (!token) return;
      await apiRequest(`/appointments/${id}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });
      loadAppointments();
      setFeedback({ type: "success", message: "Status updated." });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({ type: "error", message: fromError(err, "Failed to update status. Please try again.") });
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
      loadAppointments();
      setFeedback({ type: "success", message: "Reminder marked as sent." });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback({ type: "error", message: fromError(err, "Failed to mark reminder. Please try again.") });
    }
  };

  const getCustomerName = (customerId: string) =>
    customers.find((c) => c.id === customerId)?.name ?? "—";

  const calendarCells = buildMonthCells(calendarMonth);
  const appointmentsForMonth = appointments.filter((a) => monthKey(a.scheduledAt) === calendarMonth);
  const appointmentsByDay = appointmentsForMonth.reduce<Record<string, Appointment[]>>((acc, appointment) => {
    const key = dayKey(appointment.scheduledAt);
    acc[key] ??= [];
    acc[key].push(appointment);
    return acc;
  }, {});
  const agenda = selectedAgendaDay
    ? (appointmentsByDay[selectedAgendaDay] ?? []).slice().sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    : [];

  if (!workspace?.loading && !businesses.length) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Appointments"
          plainLanguageDescription="Appointments help you plan your day."
          whatThisPageIsFor="Schedule visits and keep each appointment status up to date."
          whatToDoNext="Create a business in Setup first, then add customers and appointments."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full">
        <PageHeader
          title="Appointments"
          plainLanguageDescription="Appointments help you plan your day — but you can use the app without them."
          whatThisPageIsFor="Schedule visits and keep each appointment status up to date."
          whatToDoNext={appointments.length === 0 ? "Create your first appointment." : "Update the next appointment status."}
          actions={
            <div className="flex flex-wrap gap-2">
              <MonthPicker value={calendarMonth} onChange={setCalendarMonth} className="w-44" />
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
            <Button onClick={() => { resetForm(); setShowForm(true); }} size="lg">
              {appointments.length === 0 ? "Create first appointment" : "New appointment"}
            </Button>
          }
          hintText="Pick a customer first, then choose a time preset or exact date and time."
        />
        {feedback && (
          <StatusBanner
            variant={feedback.type}
            message={feedback.message}
            onDismiss={() => setFeedback(null)}
          />
        )}

        <ConfirmDialog
          open={!!pendingCancel}
          onOpenChange={(o) => !o && setPendingCancel(null)}
          title="Cancel this appointment?"
          description={
            pendingCancel
              ? `This will mark the appointment for ${pendingCancel.customerName} as cancelled. You can still see it in the list.`
              : ""
          }
          confirmLabel="Yes, cancel"
          cancelLabel="No, keep it"
          destructive
          onConfirm={async () => {
            if (pendingCancel) {
              await handleStatus(pendingCancel.id, "cancelled");
            }
          }}
        />

      {showForm && (
        <div className="space-y-4 rounded-md border border-border bg-card p-4">
          {editingId ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-lg font-medium">Reschedule</h2>
              <div>
                <Label className="mb-1 block">Date & time</Label>
                <DateTimePicker
                  value={formData.scheduledAt}
                  onChange={(value) => setFormData((d) => ({ ...d, scheduledAt: value }))}
                  aria-label="Reschedule date and time"
                />
              </div>
              <div>
                <Label className="mb-1 block">Notes</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData((d) => ({ ...d, notes: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Update"}</Button>
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
              </div>
            </form>
          ) : (
            <>
              <h2 className="text-lg font-medium">Book appointment</h2>
              <ol className="grid grid-cols-5 gap-2 text-xs">
                {buildAppointmentWizardSteps(step).map((s, idx) => (
                  <li key={s.id} className={s.state === "active" ? "font-semibold text-foreground" : "text-muted-foreground"}>
                    {idx + 1}. {s.id}
                  </li>
                ))}
              </ol>
              {step === "customer" && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Button type="button" variant={entryMode === "existing" ? "default" : "outline"} onClick={() => setEntryMode("existing")}>Existing customer</Button>
                    <Button type="button" variant={entryMode === "new" ? "default" : "outline"} onClick={() => setEntryMode("new")}>New customer</Button>
                  </div>
                  {entryMode === "existing" ? (
                    <div>
                      <Label className="mb-1 block">Customer</Label>
                      <Select value={formData.customerId || "__none__"} onValueChange={(v) => setFormData((d) => ({ ...d, customerId: v === "__none__" ? "" : v }))}>
                        <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Select customer" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Select customer</SelectItem>
                          {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input placeholder="Customer name" value={newCustomer.name} onChange={(e) => setNewCustomer((v) => ({ ...v, name: e.target.value }))} />
                      <div>
                        <Input
                          type="tel"
                          placeholder={PH_MOBILE_E164_PLACEHOLDER}
                          value={newCustomer.mobile}
                          onChange={(e) => setNewCustomer((v) => ({ ...v, mobile: e.target.value }))}
                          aria-label="Mobile"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">{PH_MOBILE_E164_ERROR}</p>
                      </div>
                      <Input placeholder="Email (optional)" value={newCustomer.email} onChange={(e) => setNewCustomer((v) => ({ ...v, email: e.target.value }))} />
                      <Textarea placeholder="Notes (optional)" value={newCustomer.notes} onChange={(e) => setNewCustomer((v) => ({ ...v, notes: e.target.value }))} />
                    </div>
                  )}
                </div>
              )}
              {(step === "date" || step === "time") && (
                <div className="space-y-3">
                  <MonthPicker value={month} onChange={setMonth} className="w-48" />
                  {availabilityLoading ? <p className="text-sm text-muted-foreground">Loading available slots...</p> : (
                    <>
                      {step === "date" && (
                        <AvailabilityCalendar
                          month={month}
                          selectedDay={selectedDay}
                          availableDays={Object.keys(availability?.byDay ?? {}).sort()}
                          onSelect={(day) => setSelectedDay(day)}
                        />
                      )}
                      {step === "time" && selectedDay && (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {(availability?.byDay[selectedDay] ?? []).map((slot) => (
                            <Button key={slot} type="button" variant={formData.scheduledAt === slot.slice(0, 16) ? "default" : "outline"} onClick={() => setFormData((d) => ({ ...d, scheduledAt: slot.slice(0, 16) }))}>
                              {new Date(slot).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </Button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {step === "review" && (
                <div className="space-y-2">
                  <p className="text-sm">Customer: {entryMode === "existing" ? getCustomerName(formData.customerId) : newCustomer.name || "—"}</p>
                  <p className="text-sm">Appointment: {formData.scheduledAt ? new Date(formData.scheduledAt).toLocaleString() : "—"}</p>
                  <Input placeholder="Notes (optional)" value={formData.notes} onChange={(e) => setFormData((d) => ({ ...d, notes: e.target.value }))} />
                </div>
              )}
              {step === "done" && <p className="text-sm text-green-700">Appointment booked successfully.</p>}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                {step !== "done" && (
                  <Button
                    type="button"
                    onClick={async () => {
                      setError(null);
                      try {
                        if (step === "customer") {
                          if (!validateCustomerStep()) return;
                          setStep("date");
                        }
                        else if (step === "date") setStep("time");
                        else if (step === "time") setStep("review");
                        else if (step === "review") await completeWizardBooking();
                      } catch (err) {
                        setError(normalizeBookingError(fromError(err, "Unable to continue.")));
                      }
                    }}
                  >
                    Continue
                  </Button>
                )}
                {step === "done" ? (
                  <Button type="button" onClick={resetForm}>Close</Button>
                ) : (
                  <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <section className="space-y-4">
        {!syncReady || workspace?.loading || (!!selectedBiz && appointmentsLoading) ? (
          <ListSkeleton rowCount={5} className="mt-4" />
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
              <div className="rounded-md border border-border bg-card p-4">
                <p className="text-sm font-medium">Calendar view</p>
                <p className="text-xs text-muted-foreground">{appointmentsForMonth.length} appointments in this month</p>
                <div className="mt-3 grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-7 gap-2">
                  {calendarCells.map((day) => {
                    const dayAppointments = appointmentsByDay[day] ?? [];
                    const inMonth = day.startsWith(calendarMonth);
                    const isSelected = selectedAgendaDay === day;
                    return (
                      <button
                        key={day}
                        type="button"
                        className={`relative rounded-md border p-2 text-left text-xs ${isSelected ? "border-primary bg-primary/10" : "border-border"} ${inMonth ? "" : "opacity-50"}`}
                        onClick={() => setSelectedAgendaDay(day)}
                      >
                        <p className="font-medium">{new Date(day).getDate()}</p>
                        {dayAppointments.length > 0 && (
                          <>
                            <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary/80" aria-hidden />
                            {dayAppointments.length > 1 && (
                              <span className="absolute bottom-1 right-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                {dayAppointments.length}
                              </span>
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-md border border-border bg-card p-4">
                <p className="text-sm font-medium">Selected day agenda</p>
                <p className="text-xs text-muted-foreground">
                  {selectedAgendaDay ? new Date(selectedAgendaDay).toLocaleDateString() : "No day selected"}
                </p>
                <ul className="mt-3 divide-y divide-border">
                  {agenda.map((a) => {
                    const isNew = Date.now() - new Date(a.createdAt).getTime() < 1000 * 60 * 60 * 24;
                    return (
                      <li key={a.id} className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{getCustomerName(a.customerId)}</span>
                          <Badge
                            variant={a.status === "cancelled" ? "destructive" : a.status === "completed" ? "secondary" : "outline"}
                            className="capitalize"
                          >
                            {a.status}
                          </Badge>
                          {isNew && <Badge className="bg-emerald-600 text-white">New</Badge>}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {new Date(a.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {a.notes && ` · ${a.notes}`}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {a.status === "scheduled" && (
                            <Button size="sm" variant="outline" onClick={() => handleReminderSent(a.id)}>
                              Reminder sent
                            </Button>
                          )}
                          <Select
                            value={a.status}
                            onValueChange={(v) => {
                              const status = v as "scheduled" | "completed" | "missed" | "cancelled";
                              if (status === "cancelled") setPendingCancel({ id: a.id, customerName: getCustomerName(a.customerId) });
                              else handleStatus(a.id, status);
                            }}
                          >
                            <SelectTrigger className="min-h-[40px] capitalize" aria-label="Change status">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="scheduled">Scheduled</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="missed">Missed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                          {a.status === "scheduled" && (
                            <Button size="sm" variant="outline" onClick={() => handleEdit(a as Appointment)}>
                              Reschedule
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {agenda.length === 0 && (
                  <p className="mt-3 text-sm text-muted-foreground">No appointments for this day.</p>
                )}
              </div>
            </div>
            {appointments.length === 0 && (
              <EmptyState
                what="No appointments yet"
                why="Appointments help you plan your day — but you can use the app without them."
                nextAction={
                  <Button onClick={() => { resetForm(); setShowForm(true); }}>
                    Create first appointment
                  </Button>
                }
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default function AppointmentsPage() {
  return <AppointmentsPageContent />;
}
