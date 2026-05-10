"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { hasClerk } from "@/lib/clerk";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { ListSkeleton } from "@/components/ui/skeleton";
import { StatusBanner } from "@/components/ui/status-banner";
import { PrimaryPageAction } from "@/components/ui/primary-page-action";
import { useWorkspace } from "@/contexts/workspace-context";
import { recordOnboardingEvent } from "@/lib/onboarding-metrics";
import { fromError } from "@/lib/ui-feedback";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { buildAppointmentWizardSteps, type BookingStep } from "./wizard-progress";
import {
  canSubmitVerify,
  defaultVerifyMode,
  normalizeBookingError,
  shouldShowManagerPinSetupOnAppointments,
  type VerifyMode,
} from "./booking-flow";

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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCustomer, setNewCustomer] = useState({ name: "", mobile: "", email: "", notes: "" });
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [holdId, setHoldId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [pin, setPin] = useState("");
  const [skipReason, setSkipReason] = useState("");
  const [staffName, setStaffName] = useState("");
  const [verifyMode, setVerifyMode] = useState<VerifyMode>("otp");
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
      let url = `/appointments?businessId=${selectedBiz}`;
      if (dateFrom) url += `&from=${new Date(dateFrom).toISOString()}`;
      if (dateTo) url += `&to=${new Date(dateTo).toISOString()}`;
      const res = await apiRequest<{ appointments: Appointment[] }>(url, { token });
      setAppointments(res.appointments);
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
  }, [selectedBiz, dateFrom, dateTo]);

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
    setHoldId(null);
    setOtpCode("");
    setPin("");
    setSkipReason("");
    setVerifyMode("otp");
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
    const res = await apiRequest<{ customer: { id: string } }>("/customers", {
      method: "POST",
      token,
      body: JSON.stringify({
        businessId: selectedBiz,
        name: newCustomer.name.trim(),
        mobile: newCustomer.mobile.trim() || undefined,
        email: newCustomer.email.trim() || undefined,
        notes: newCustomer.notes.trim() || undefined,
      }),
    });
    await loadCustomers();
    setFormData((prev) => ({ ...prev, customerId: res.customer.id }));
    return res.customer.id;
  };

  const startOtpFlow = async () => {
    if (!selectedBiz || !formData.scheduledAt) return;
    const customerId = await ensureCustomerForWizard();
    if (!customerId) throw new Error("Select or create a customer first.");
    const token = await getToken();
    if (!token) return;
    const mobile =
      entryMode === "new"
        ? newCustomer.mobile.trim()
        : (customers.find((c) => c.id === customerId)?.mobile ?? "").trim();
    const holdMobile = mobile || "NO_PHONE_AVAILABLE";
    const holdRes = await apiRequest<{ hold: { id: string } }>("/appointments/booking/hold", {
      method: "POST",
      token,
      body: JSON.stringify({
        businessId: selectedBiz,
        customerId,
        mobile: holdMobile,
        scheduledAt: new Date(formData.scheduledAt).toISOString(),
      }),
    });
    if (mobile) {
      await apiRequest("/appointments/booking/otp/send", {
        method: "POST",
        token,
        body: JSON.stringify({ holdId: holdRes.hold.id }),
      });
    }
    setHoldId(holdRes.hold.id);
    setVerifyMode(defaultVerifyMode({ mobile }));
    setStep("verify");
  };

  const completeWithOtp = async () => {
    if (!holdId) return;
    const token = await getToken();
    if (!token) return;
    await apiRequest("/appointments/booking/otp/verify", {
      method: "POST",
      token,
      body: JSON.stringify({ holdId, code: otpCode }),
    });
    await loadAppointments();
    setFeedback({ type: "success", message: "Appointment created." });
    setStep("done");
  };

  const completeWithPinOverride = async () => {
    if (!holdId || !selectedBiz) return;
    const token = await getToken();
    if (!token) return;
    await apiRequest("/appointments/booking/pin", {
      method: "POST",
      token,
      body: JSON.stringify({
        businessId: selectedBiz,
        holdId,
        pin,
        reason: skipReason,
        staffName: staffName.trim() || undefined,
      }),
    });
    await loadAppointments();
    setFeedback({ type: "success", message: "Appointment created with manager override." });
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
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="From"
                className="w-36"
                aria-label="From date"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="To"
                className="w-36"
                aria-label="To date"
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
        {!shouldShowManagerPinSetupOnAppointments() && (
          <div className="rounded-md border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground">Manager override</p>
            <p className="mt-1 text-xs text-muted-foreground">
              PIN setup is managed in Settings. Use manager override only when customer OTP is not possible.
            </p>
          </div>
        )}
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
                <Input
                  type="datetime-local"
                  value={formData.scheduledAt}
                  onChange={(e) => setFormData((d) => ({ ...d, scheduledAt: e.target.value }))}
                  required
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
                      <Input placeholder="Mobile" value={newCustomer.mobile} onChange={(e) => setNewCustomer((v) => ({ ...v, mobile: e.target.value }))} />
                      <Input placeholder="Email (optional)" value={newCustomer.email} onChange={(e) => setNewCustomer((v) => ({ ...v, email: e.target.value }))} />
                      <Textarea placeholder="Notes (optional)" value={newCustomer.notes} onChange={(e) => setNewCustomer((v) => ({ ...v, notes: e.target.value }))} />
                    </div>
                  )}
                </div>
              )}
              {(step === "date" || step === "time") && (
                <div className="space-y-3">
                  <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-48" />
                  {availabilityLoading ? <p className="text-sm text-muted-foreground">Loading available slots...</p> : (
                    <>
                      {step === "date" && (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {Object.keys(availability?.byDay ?? {}).sort().map((day) => (
                            <Button key={day} type="button" variant={selectedDay === day ? "default" : "outline"} onClick={() => setSelectedDay(day)}>
                              {new Date(day).toLocaleDateString()}
                            </Button>
                          ))}
                        </div>
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
              {step === "verify" && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Button type="button" variant={verifyMode === "otp" ? "default" : "outline"} onClick={() => setVerifyMode("otp")}>
                      Verify via OTP
                    </Button>
                    <Button type="button" variant={verifyMode === "override" ? "default" : "outline"} onClick={() => setVerifyMode("override")}>
                      Manager override
                    </Button>
                  </div>
                  {verifyMode === "otp" && (
                    <div>
                      <Label className="mb-1 block">OTP code</Label>
                      <Input value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="6-digit OTP" />
                      <Button type="button" className="mt-2" onClick={() => void completeWithOtp()} disabled={submitting || !canSubmitVerify({ mode: "otp", otpCode })}>Verify OTP and confirm</Button>
                    </div>
                  )}
                  {verifyMode === "override" && (
                    <div className="rounded-md border border-border p-3">
                      <p className="text-sm font-medium">Manager override (when customer OTP is not possible)</p>
                      <Input className="mt-2" type="password" placeholder="Manager PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
                      <Input className="mt-2" placeholder="Reason for OTP skip" value={skipReason} onChange={(e) => setSkipReason(e.target.value)} />
                      <Input className="mt-2" placeholder="Staff name (optional)" value={staffName} onChange={(e) => setStaffName(e.target.value)} />
                      <Button type="button" className="mt-2" variant="outline" onClick={() => void completeWithPinOverride()} disabled={!canSubmitVerify({ mode: "override", pin, reason: skipReason })}>
                        Confirm with manager override
                      </Button>
                    </div>
                  )}
                </div>
              )}
              {step === "done" && <p className="text-sm text-green-700">Appointment booked successfully.</p>}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                {step !== "done" && step !== "verify" && (
                  <Button
                    type="button"
                    onClick={async () => {
                      setError(null);
                      try {
                        if (step === "customer") setStep("date");
                        else if (step === "date") setStep("time");
                        else if (step === "time") setStep("review");
                        else if (step === "review") await startOtpFlow();
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

      <PageSection>
        <p className="text-sm text-muted-foreground">{appointments.length} appointment{appointments.length !== 1 ? "s" : ""}</p>
        {!syncReady || workspace?.loading || (!!selectedBiz && appointmentsLoading) ? (
          <ListSkeleton rowCount={5} className="mt-4" />
        ) : (
          <>
        <ul className="mt-4 divide-y divide-border">
          {appointments.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 py-5 first:pt-0"
            >
              <div>
                <span className="font-medium">{getCustomerName(a.customerId)}</span>
                <Badge
                  variant={a.status === "cancelled" ? "destructive" : a.status === "completed" ? "secondary" : "outline"}
                  className={a.status !== "cancelled" && a.status !== "completed" ? "bg-primary/10 border-primary/20 capitalize" : "capitalize"}
                >
                  {a.status}
                </Badge>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(a.scheduledAt).toLocaleString()}
                  {a.notes && ` · ${a.notes}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                    {a.status === "scheduled" && (
                      <Button size="sm" variant="outline" onClick={() => handleReminderSent(a.id)}>
                        Reminder sent
                      </Button>
                    )}
                    <Select
                      value={a.status}
                      onValueChange={(v) => {
                        const status = v as "scheduled" | "completed" | "missed" | "cancelled";
                        if (status === "cancelled") {
                          setPendingCancel({ id: a.id, customerName: getCustomerName(a.customerId) });
                        } else {
                          handleStatus(a.id, status);
                        }
                      }}
                    >
                      <SelectTrigger className="min-h-[44px] capitalize" aria-label="Change status">
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
          ))}
        </ul>
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
      </PageSection>
    </div>
  );
}

export default function AppointmentsPage() {
  if (!hasClerk) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Appointments</h1>
        <p className="mt-2 text-muted-foreground">
          Clerk authentication is not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to manage appointments.
        </p>
      </div>
    );
  }
  return <AppointmentsPageContent />;
}
