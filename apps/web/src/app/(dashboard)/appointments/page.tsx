"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@suki/ui";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { hasClerk } from "@/lib/clerk";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { ListSkeleton } from "@/components/ui/skeleton";
import { StatusBanner } from "@/components/ui/status-banner";
import { PrimaryPageAction } from "@/components/ui/primary-page-action";
import {
  PracticeDayBanner,
  OnboardingGuidance,
  TooltipBadge,
} from "@/components/onboarding";
import { useOnboarding } from "@/contexts/onboarding-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { ONBOARDING_STEPS, SAMPLE_APPOINTMENTS, SAMPLE_CUSTOMERS, PRACTICE_SAMPLE_LABEL } from "@/lib/onboarding";
import { recordOnboardingEvent } from "@/lib/onboarding-metrics";
import { fromError } from "@/lib/ui-feedback";

interface Business {
  id: string;
  name: string;
  businessType: string;
}

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

function AppointmentsPageContent() {
  const { getToken } = useAuth();
  const { data: syncData } = useAuthSync();
  const onboarding = useOnboarding();
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
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

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
  };

  const applyTimePreset = (preset: "morning" | "afternoon" | "evening") => {
    const d = formData.scheduledAt ? new Date(formData.scheduledAt) : new Date();
    if (preset === "morning") d.setHours(9, 0, 0, 0);
    else if (preset === "afternoon") d.setHours(14, 0, 0, 0);
    else d.setHours(18, 0, 0, 0);
    setFormData((prev) => ({ ...prev, scheduledAt: d.toISOString().slice(0, 16) }));
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
        onboarding?.advanceStep();
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
    customers.find((c) => c.id === customerId)?.name ??
    (SAMPLE_APPOINTMENTS.find((a) => a.customerId === customerId)?.customerName ?? "—");

  const showPracticeData = onboarding?.practiceMode && !onboarding.onboardingCompletedAt;
  const displayAppointments = showPracticeData ? SAMPLE_APPOINTMENTS : appointments;
  const displayCustomers = showPracticeData ? SAMPLE_CUSTOMERS : customers;

  if (!workspace?.loading && !businesses.length) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Appointments</h1>
        <p className="mt-2 text-muted-foreground">Create a business in Setup first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="empty:hidden">
        <PracticeDayBanner />
        <OnboardingGuidance
          step={ONBOARDING_STEPS.appointmentsOverview}
          screen="appointments"
          onComplete={() => {}}
        />
      </div>
      <div className="space-y-8">
        <PageHeader
          title={<TooltipBadge screen="appointments">Appointments</TooltipBadge>}
          plainLanguageDescription="Appointments help you plan your day — but you can use the app without them."
          whatThisPageIsFor="Schedule visits and keep each appointment status up to date."
          whatToDoNext={displayAppointments.length === 0 ? "Create your first appointment." : "Update the next appointment status."}
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
              {displayAppointments.length === 0 ? "Create first appointment" : "New appointment"}
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

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-md border border-border bg-card p-4"
        >
          <h2 className="text-lg font-medium">{editingId ? "Reschedule" : "New appointment"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Customer</label>
              <select
                value={formData.customerId}
                onChange={(e) => setFormData((d) => ({ ...d, customerId: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[44px]"
                required
                disabled={!!editingId}
                aria-label="Select customer"
              >
                <option value="">Select customer</option>
                {(showPracticeData ? displayCustomers : customers).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Date & time</label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => applyTimePreset("morning")}>
                  Morning
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => applyTimePreset("afternoon")}>
                  Afternoon
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => applyTimePreset("evening")}>
                  Evening
                </Button>
              </div>
              <Input
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) => setFormData((d) => ({ ...d, scheduledAt: e.target.value }))}
                required
                className="mt-2"
              />
            </div>
          </div>
          {!editingId && (
            <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3">
              <input
                type="checkbox"
                id="reminders-on"
                checked={formData.remindersOn}
                onChange={(e) => setFormData((d) => ({ ...d, remindersOn: e.target.checked }))}
                className="mt-1 rounded"
              />
              <label htmlFor="reminders-on" className="text-sm text-foreground">
                We&apos;ll remind the customer so you don&apos;t have to.
              </label>
            </div>
          )}
          <p className="text-sm text-muted-foreground">Nothing is final until you confirm.</p>
          <div>
            <label className="mb-1 block text-sm font-medium">Notes</label>
            <Input
              value={formData.notes}
              onChange={(e) => setFormData((d) => ({ ...d, notes: e.target.value }))}
              placeholder="Optional"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : editingId ? "Update" : "Create"}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <PageSection>
        <p className="text-sm text-muted-foreground">{displayAppointments.length} appointment{displayAppointments.length !== 1 ? "s" : ""}</p>
        {!syncReady || workspace?.loading || (!!selectedBiz && appointmentsLoading) ? (
          <ListSkeleton rowCount={5} className="mt-4" />
        ) : (
          <>
        <ul className="mt-4 divide-y divide-border">
          {displayAppointments.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 py-5 first:pt-0"
            >
              <div>
                <span className="font-medium">{getCustomerName(a.customerId)}</span>
                {"isPracticeSample" in a && (a as { isPracticeSample?: boolean }).isPracticeSample && (
                  <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                    {PRACTICE_SAMPLE_LABEL}
                  </span>
                )}
                <span className={`ml-2 rounded px-2 py-0.5 text-xs capitalize ${a.status === "completed" ? "bg-muted" : a.status === "cancelled" ? "bg-destructive/10" : "bg-primary/10"}`}>
                  {a.status}
                </span>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(a.scheduledAt).toLocaleString()}
                  {a.notes && ` · ${a.notes}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!("isPracticeSample" in a && (a as { isPracticeSample?: boolean }).isPracticeSample) && "businessId" in a && (
                  <>
                    {a.status === "scheduled" && (
                      <Button size="sm" variant="outline" onClick={() => handleReminderSent(a.id)}>
                        Reminder sent
                      </Button>
                    )}
                    <select
                      value={a.status}
                      onChange={(e) => {
                        const v = e.target.value as "scheduled" | "completed" | "missed" | "cancelled";
                        if (v === "cancelled") {
                          if (confirm("Cancel this appointment?")) handleStatus(a.id, v);
                        } else {
                          handleStatus(a.id, v);
                        }
                      }}
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm capitalize min-h-[44px]"
                      aria-label="Change status"
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="completed">Completed</option>
                      <option value="missed">Missed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    {a.status === "scheduled" && (
                      <Button size="sm" variant="outline" onClick={() => handleEdit(a as Appointment)}>
                        Reschedule
                      </Button>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
        {displayAppointments.length === 0 && (
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
