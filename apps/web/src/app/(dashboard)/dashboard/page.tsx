"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Plus, Share2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { IntakeQRBlock } from "@/components/intake-qr-block";
import { ListSkeleton, MetricGridSkeleton } from "@/components/ui/skeleton";
import { StatusBanner } from "@/components/ui/status-banner";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { useWorkspace } from "@/contexts/workspace-context";
import { recordOnboardingEvent } from "@/lib/onboarding-metrics";
import { getOpenManualFollowUpCount } from "@/components/needs-attention/manual-follow-up.api";

interface Summary { businesses: number; customers: number; appointments: number; promos: number }
interface Usage { visitsThisMonth: number; month: string; upcomingAppointments?: number }
interface Activity { type: string; description: string; at: string; businessName?: string }
interface DayAppointment {
  id: string;
  customerId: string;
  scheduledAt: string;
  durationMinutes: number;
  status: "scheduled" | "checked_in" | "needs_review" | "completed" | "missed" | "cancelled";
}
interface DayCustomer { id: string; name: string }

const STATUS_LABELS: Record<DayAppointment["status"], string> = {
  scheduled: "Scheduled", checked_in: "Arrived", needs_review: "Needs review",
  completed: "Completed", missed: "Missed", cancelled: "Cancelled",
};

function DashboardPageContent() {
  const searchParams = useSearchParams();
  const { getToken } = useAuth();
  const { data: syncData } = useAuthSync();
  const workspace = useWorkspace();
  const businessId = workspace?.activeBusinessId ?? "";
  const business = workspace?.businesses.find((item) => item.id === businessId);
  const organizationId = syncData?.organization?.id ?? null;
  const activeBusiness = useRef(businessId);
  const agendaRequest = useRef(0);
  const [appointments, setAppointments] = useState<DayAppointment[]>([]);
  const [customers, setCustomers] = useState<DayCustomer[]>([]);
  const [agendaLoading, setAgendaLoading] = useState(true);
  const [agendaError, setAgendaError] = useState<string | null>(null);
  const [pendingArrival, setPendingArrival] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [attentionCount, setAttentionCount] = useState<number | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState(false);
  const [overviewRetry, setOverviewRetry] = useState(0);

  useEffect(() => {
    if (organizationId) recordOnboardingEvent("dashboard_viewed", organizationId);
  }, [organizationId]);

  const loadAgenda = useCallback(async () => {
    const request = ++agendaRequest.current;
    setAgendaError(null);
    if (!businessId) {
      setAppointments([]);
      setCustomers([]);
      setAgendaLoading(false);
      return false;
    }
    setAgendaLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Your session is unavailable.");
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setHours(23, 59, 59, 999);
      const query = new URLSearchParams({ businessId, from: from.toISOString(), to: to.toISOString() });
      const [day, people] = await Promise.all([
        apiRequest<{ appointments: DayAppointment[] }>(`/appointments?${query}`, { token }),
        apiRequest<{ customers: DayCustomer[] }>(`/customers?businessId=${encodeURIComponent(businessId)}&limit=500`, { token }),
      ]);
      if (request !== agendaRequest.current) return false;
      setAppointments((day.appointments ?? []).slice().sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)));
      setCustomers(people.customers ?? []);
      return true;
    } catch {
      if (request === agendaRequest.current) setAgendaError("Unable to load today's appointments.");
      return false;
    } finally {
      if (request === agendaRequest.current) setAgendaLoading(false);
    }
  }, [businessId, getToken]);

  useEffect(() => {
    activeBusiness.current = businessId;
    setAppointments([]);
    setCustomers([]);
    setFeedback(null);
    void loadAgenda();
    return () => { agendaRequest.current += 1; };
  }, [businessId, loadAgenda]);

  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    setUsage(null);
    setActivities([]);
    setAttentionCount(null);
    if (!organizationId) return;
    setOverviewLoading(true);
    setOverviewError(false);
    void (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Your session is unavailable.");
        const results = await Promise.allSettled([
          apiRequest<Summary>("/admin/summary", { token }),
          apiRequest<Usage>(`/admin/usage${businessId ? `?businessId=${encodeURIComponent(businessId)}` : ""}`, { token }),
          apiRequest<{ activities: Activity[] }>("/admin/activity?limit=15", { token }),
          getOpenManualFollowUpCount(),
        ]);
        if (cancelled) return;
        if (results[0].status === "fulfilled") setSummary(results[0].value);
        if (results[1].status === "fulfilled") setUsage(results[1].value);
        if (results[2].status === "fulfilled") setActivities(results[2].value.activities ?? []);
        if (results[3].status === "fulfilled") setAttentionCount(results[3].value.count);
        setOverviewError(results.some((result) => result.status === "rejected"));
      } catch {
        if (!cancelled) setOverviewError(true);
      } finally {
        if (!cancelled) setOverviewLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [organizationId, businessId, getToken, overviewRetry]);

  async function markArrived(id: string) {
    if (pendingArrival) return;
    setPendingArrival(id);
    setFeedback(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Your session is unavailable.");
      await apiRequest(`/appointments/${id}/arrive`, { method: "PATCH", token });
      if (activeBusiness.current !== businessId) return;
      setAppointments((items) => items.map((item) => item.id === id ? { ...item, status: "checked_in" } : item));
      const refreshed = await loadAgenda();
      if (activeBusiness.current !== businessId) return;
      setFeedback(refreshed
        ? { type: "success", message: "Arrival recorded. Suki will record the visit automatically." }
        : { type: "error", message: "Arrival recorded, but the list could not refresh. Retry the list; do not mark Arrived again." });
    } catch (error) {
      if (activeBusiness.current === businessId) setFeedback({ type: "error", message: error instanceof Error ? error.message : "Unable to record arrival. Please retry." });
    } finally {
      setPendingArrival(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Today" plainLanguageDescription="Your appointments and the reminders that need you."
        actions={<Button asChild variant="outline"><Link href="/share-slots"><Share2 className="size-4" aria-hidden />Share booking link</Link></Button>} />
      {searchParams?.get("welcome") === "1" ? <StatusBanner variant="success" message="Your workspace is ready. Book an appointment or share your booking link whenever you are ready." /> : null}
      {feedback ? <StatusBanner variant={feedback.type} message={feedback.message} onDismiss={() => setFeedback(null)} /> : null}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <MetricCard label="Appointments" value={agendaLoading || agendaError ? "—" : appointments.length} suffix="Today" />
        <MetricCard label="Needs attention" value={attentionCount ?? "—"} suffix="Open reminders" />
        <MetricCard label="Completed" value={agendaLoading || agendaError ? "—" : appointments.filter((item) => item.status === "completed").length} suffix="Today" />
      </div>
      {attentionCount != null && attentionCount > 0 ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div><h2 className="font-semibold">{attentionCount} reminder{attentionCount === 1 ? "" : "s"} need attention</h2><p className="text-sm text-muted-foreground">Review delivery before contacting customers.</p></div>
          <Button asChild variant="outline"><Link href="/needs-attention">Review reminders</Link></Button>
        </section>
      ) : null}
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
          <div><h2 className="font-semibold">Today&apos;s appointments</h2><p className="text-sm text-muted-foreground">{new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })}</p></div>
          <Button asChild variant="ghost" size="sm"><Link href="/appointments">View all</Link></Button>
        </div>
        {workspace?.loading || agendaLoading ? <ListSkeleton rowCount={3} className="p-5" /> : !businessId ? (
          <div className="space-y-3 p-5"><p className="text-muted-foreground">Add your business to start taking bookings.</p><Button asChild><Link href="/setup">Set up business</Link></Button></div>
        ) : agendaError ? (
          <div className="space-y-3 p-5"><StatusBanner variant="error" message={agendaError} /><Button variant="outline" onClick={() => void loadAgenda()}>Retry</Button></div>
        ) : appointments.length === 0 ? (
          <div className="space-y-3 p-5"><CalendarDays className="size-6 text-muted-foreground" aria-hidden /><h3 className="font-medium">No appointments today</h3><p className="text-sm text-muted-foreground">Your next booking will appear here.</p><Button asChild><Link href="/appointments?new=1"><Plus className="size-4" aria-hidden />New appointment</Link></Button></div>
        ) : (
          <ul className="divide-y divide-border">
            {appointments.map((appointment) => (
              <li key={appointment.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
                <div className="flex min-w-0 items-center gap-3"><time className="w-20 shrink-0 text-sm font-medium tabular-nums">{new Date(appointment.scheduledAt).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}</time><div className="min-w-0"><p className="break-words font-medium">{customers.find((customer) => customer.id === appointment.customerId)?.name ?? "Customer"}</p><p className="text-sm text-muted-foreground">{STATUS_LABELS[appointment.status]} · {appointment.durationMinutes} min</p></div></div>
                <div className="flex flex-wrap gap-2">
                  {appointment.status === "scheduled" ? <Button size="sm" disabled={pendingArrival != null} onClick={() => void markArrived(appointment.id)}>{pendingArrival === appointment.id ? "Recording…" : "Arrived"}</Button> : null}
                  {appointment.status === "scheduled" || appointment.status === "needs_review" ? <Button asChild size="sm" variant="outline"><Link href={`/appointments?reschedule=${encodeURIComponent(appointment.id)}`}>Reschedule</Link></Button> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="flex flex-wrap gap-3"><Button asChild variant="outline"><Link href="/appointments?new=1">New appointment</Link></Button><Button asChild variant="ghost"><Link href="/settings#automation">Automation settings</Link></Button></div>
      {businessId ? <section className="rounded-xl border border-border bg-card p-4"><h2 className="font-semibold">Getting started</h2><p className="mt-1 text-sm text-muted-foreground">Your business is set up. These next steps are optional.</p><div className="mt-3 flex flex-wrap gap-3"><Button asChild variant="outline" size="sm"><Link href="/appointments?new=1">Book an appointment</Link></Button><Button asChild variant="outline" size="sm"><Link href="/share-slots">Share your booking link</Link></Button></div></section> : null}
      {overviewError ? <StatusBanner variant="error" message={<span>Some workspace numbers could not load. <Button variant="link" size="sm" onClick={() => setOverviewRetry((value) => value + 1)}>Retry workspace numbers</Button></span>} /> : null}
      <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Business overview</h2><span className="text-sm text-muted-foreground">{usage?.month ? `Month: ${usage.month}` : "Monthly activity"}</span></div>
        {overviewLoading ? <MetricGridSkeleton count={3} /> : <div className="grid gap-3 sm:grid-cols-3"><MetricCard label="Total customers" value={summary?.customers ?? "—"} suffix="Saved customer records" /><MetricCard label="Visits this month" value={usage?.visitsThisMonth ?? "—"} suffix="Recorded visits" /><MetricCard label="Upcoming appointments" value={usage?.upcomingAppointments ?? "—"} suffix="All future bookings" /></div>}
      </section>
      {businessId ? <section className="rounded-xl border border-border bg-card p-4 sm:p-5"><IntakeQRBlock businessId={businessId} businessName={business?.name ?? ""} heading="Your booking link and QR" helperText="Share with customers or print for your counter." showPrintButton /></section> : null}
      {activities.length > 0 ? <section className="rounded-xl border border-border bg-card p-4 sm:p-5"><h2 className="font-semibold">Recent activity</h2><ul className="mt-3 divide-y divide-border">{activities.slice(0, 15).map((activity, index) => <li key={`${activity.type}-${activity.at}-${index}`} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><div><p>{activity.description}</p>{activity.businessName ? <p className="text-muted-foreground">{activity.businessName}</p> : null}</div><time className="text-muted-foreground">{activity.at.slice(0, 10)}</time></li>)}</ul></section> : null}
    </div>
  );
}

export default function DashboardPage() {
  return <Suspense fallback={<p className="text-muted-foreground">Loading today…</p>}><DashboardPageContent /></Suspense>;
}
