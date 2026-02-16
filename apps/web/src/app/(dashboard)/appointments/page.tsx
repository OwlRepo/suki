"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@suki/ui";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { hasClerk } from "@/lib/clerk";

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
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<string>("");
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

  const loadBusinesses = async () => {
    const token = await getToken();
    if (!token) return;
    const res = await apiRequest<{ businesses: Business[] }>("/businesses", { token });
    setBusinesses(res.businesses);
    if (res.businesses.length && !selectedBiz) setSelectedBiz(res.businesses[0].id);
  };

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
    loadBusinesses().finally(() => setLoading(false));
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

  const getCustomerName = (customerId: string) =>
    customers.find((c) => c.id === customerId)?.name ?? "—";

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (!businesses.length) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Appointments</h1>
        <p className="mt-2 text-muted-foreground">Create a business in Setup first.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Appointments</h1>
        <div className="flex flex-wrap gap-2">
          <select
            value={selectedBiz}
            onChange={(e) => setSelectedBiz(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
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
          className="mt-4 space-y-4 rounded-md border border-border bg-card p-4"
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
                {customers.map((c) => (
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

      <div className="mt-6">
        <p className="text-sm text-muted-foreground">{appointments.length} appointment{appointments.length !== 1 ? "s" : ""}</p>
        <ul className="mt-2 divide-y divide-border">
          {appointments.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0"
            >
              <div>
                <span className="font-medium">{getCustomerName(a.customerId)}</span>
                <span className={`ml-2 rounded px-2 py-0.5 text-xs capitalize ${a.status === "completed" ? "bg-muted" : a.status === "cancelled" ? "bg-destructive/10" : "bg-primary/10"}`}>
                  {a.status}
                </span>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(a.scheduledAt).toLocaleString()}
                  {a.notes && ` · ${a.notes}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => handleEdit(a)}>
                  Reschedule
                </Button>
                {a.status === "scheduled" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => handleStatus(a.id, "completed")}>
                      Complete
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleStatus(a.id, "missed")}>
                      Missed
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleStatus(a.id, "cancelled")}>
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
        {appointments.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">No appointments. Create one to get started.</p>
        )}
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
