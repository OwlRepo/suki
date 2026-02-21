"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@suki/ui";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { hasClerk } from "@/lib/clerk";
import {
  PracticeDayBanner,
  OnboardingGuidance,
  TooltipBadge,
} from "@/components/onboarding";
import { useOnboarding } from "@/contexts/onboarding-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { ONBOARDING_STEPS, SAMPLE_APPOINTMENTS, SAMPLE_CUSTOMERS, PRACTICE_SAMPLE_LABEL } from "@/lib/onboarding";
import { recordOnboardingEvent } from "@/lib/onboarding-metrics";

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
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    customerId: "",
    scheduledAt: "",
    notes: "",
  });
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    let url = `/appointments?businessId=${selectedBiz}`;
    if (dateFrom) url += `&from=${new Date(dateFrom).toISOString()}`;
    if (dateTo) url += `&to=${new Date(dateTo).toISOString()}`;
    const res = await apiRequest<{ appointments: Appointment[] }>(url, { token });
    setAppointments(res.appointments);
  };

  useEffect(() => {
    if (!syncData) return;
    setLoading(false);
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
    setFormData({ customerId: "", scheduledAt: "", notes: "" });
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const handleEdit = (a: Appointment) => {
    setEditingId(a.id);
    setFormData({
      customerId: a.customerId,
      scheduledAt: a.scheduledAt.slice(0, 16),
      notes: a.notes ?? "",
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
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
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
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
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to mark reminder");
    }
  };

  const getCustomerName = (customerId: string) =>
    customers.find((c) => c.id === customerId)?.name ??
    (SAMPLE_APPOINTMENTS.find((a) => a.customerId === customerId)?.customerName ?? "—");

  const showPracticeData = onboarding?.practiceMode && !onboarding.onboardingCompletedAt;
  const displayAppointments = showPracticeData ? SAMPLE_APPOINTMENTS : appointments;
  const displayCustomers = showPracticeData ? SAMPLE_CUSTOMERS : customers;

  if (loading || workspace?.loading) return <p className="text-muted-foreground">Loading...</p>;
  if (!businesses.length) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Appointments</h1>
        <p className="mt-2 text-muted-foreground">Create a business in Setup first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
      <PracticeDayBanner />
      <OnboardingGuidance
        step={ONBOARDING_STEPS.appointmentsOverview}
        screen="appointments"
        onComplete={() => {}}
      />
      </div>
      <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground">
          <TooltipBadge screen="appointments">Appointments</TooltipBadge>
        </h1>
        <div className="flex flex-wrap gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="From"
            className="w-36"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="To"
            className="w-36"
          />
          <Button onClick={() => { resetForm(); setShowForm(true); }}>
            New appointment
          </Button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-4 rounded-md border border-border bg-card p-4"
        >
          <h2 className="text-lg font-medium">{editingId ? "Reschedule" : "New appointment"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Customer</label>
              <select
                value={formData.customerId}
                onChange={(e) => setFormData((d) => ({ ...d, customerId: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
                disabled={!!editingId}
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
              <Input
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) => setFormData((d) => ({ ...d, scheduledAt: e.target.value }))}
                required
              />
            </div>
          </div>
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

      <div className="mt-8">
        <p className="text-sm text-muted-foreground">{displayAppointments.length} appointment{displayAppointments.length !== 1 ? "s" : ""}</p>
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
              <div className="flex flex-wrap gap-2">
                {!("isPracticeSample" in a && (a as { isPracticeSample?: boolean }).isPracticeSample) && "businessId" in a && (
                  <Button size="sm" variant="outline" onClick={() => handleEdit(a as Appointment)}>
                    Reschedule
                  </Button>
                )}
                {a.status === "scheduled" && !("isPracticeSample" in a && (a as { isPracticeSample?: boolean }).isPracticeSample) && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => handleReminderSent(a.id)}>
                      Reminder sent
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleStatus(a.id, "completed")}>
                      Complete
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleStatus(a.id, "missed")}>
                      Missed
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm("Cancel this appointment?")) handleStatus(a.id, "cancelled");
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
        {displayAppointments.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">No appointments. Create one to get started. Your schedule is now active when you add your first.</p>
        )}
      </div>
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
