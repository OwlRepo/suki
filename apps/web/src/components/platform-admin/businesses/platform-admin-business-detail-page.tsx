"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListSkeleton, MetricGridSkeleton } from "@/components/ui/skeleton";
import { StatusBanner } from "@/components/ui/status-banner";
import { Textarea } from "@/components/ui/textarea";
import { createPlatformAdminBillingRequest } from "../billing/platform-admin-billing.api";
import {
  createSmsAdjustment,
  getPlatformAdminBillingAddons,
  getPlatformAdminBusiness,
  type PlatformAdminBusinessDetail,
} from "./platform-admin-businesses.api";

export function PlatformAdminBusinessDetailPage({
  organizationId,
}: {
  organizationId: string;
}) {
  const [detail, setDetail] = useState<PlatformAdminBusinessDetail | null>(null);
  const [addons, setAddons] = useState<Array<{ sku: string; units: number; pricePhp: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [requestForm, setRequestForm] = useState({
    sku: "sms-segment-topup-25",
    quantity: "1",
    notes: "",
  });
  const [adjustmentForm, setAdjustmentForm] = useState({
    type: "promotional_grant" as "promotional_grant" | "admin_correction",
    units: "",
    reason: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [business, addonResponse] = await Promise.all([
        getPlatformAdminBusiness(organizationId),
        getPlatformAdminBillingAddons(),
      ]);
      setDetail(business);
      setAddons(addonResponse.addons);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load business");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createBillingRequest() {
    setSubmitting(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const response = await createPlatformAdminBillingRequest({
        organizationId,
        sku: requestForm.sku,
        quantity: Number(requestForm.quantity),
        notes: requestForm.notes || null,
      });
      setActionMessage(
        `Created ${response.billingRequest.referenceNumber}. Payment instructions are ready to copy from the request detail.`,
      );
      await refresh();
    } catch (err) {
      setActionError(readableError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAdjustment() {
    setSubmitting(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await createSmsAdjustment(organizationId, {
        type: adjustmentForm.type,
        units: Number(adjustmentForm.units),
        reason: adjustmentForm.reason,
      });
      setActionMessage("SMS credit adjustment applied.");
      await refresh();
    } catch (err) {
      setActionError(readableError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full space-y-6 sm:space-y-8">
      <PageHeader
        title={detail?.organization.name ?? "Business Detail"}
        plainLanguageDescription="Review tenant credit balances, billing requests, and payment history."
        whatThisPageIsFor="Use this page to create add-on requests or apply SMS grants and corrections."
        whatToDoNext="Check the current balance first, then create a request or adjustment with a clear reason."
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => void refresh()}
            className="w-full gap-2 sm:w-auto"
          >
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        }
      />

      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-bold text-slate-950">Loading business</h2>
          <MetricGridSkeleton count={4} className="mt-4" />
          <ListSkeleton rowCount={4} className="mt-4" />
        </section>
      ) : null}

      {error ? (
        <div className="space-y-3">
          <StatusBanner variant="error" message={error} onDismiss={() => setError(null)} />
          <Button type="button" variant="outline" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      ) : null}

      {actionError ? (
        <StatusBanner variant="error" message={actionError} onDismiss={() => setActionError(null)} />
      ) : null}
      {actionMessage ? (
        <StatusBanner variant="success" message={actionMessage} onDismiss={() => setActionMessage(null)} />
      ) : null}

      {!loading && !error && !detail ? (
        <EmptyState
          what="Business not found"
          why="The organization may not exist or may no longer be available."
          nextAction={
            <Button type="button" variant="outline" onClick={() => void refresh()}>
              Retry
            </Button>
          }
        />
      ) : null}

      {!loading && !error && detail ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric title="Plan" value={detail.organization.currentPlan ?? "free"} />
            <Metric title="Billing" value={formatStatus(detail.organization.billingStatus ?? "free_active")} />
            <Metric title="SMS remaining" value={String(detail.smsLedger.remaining)} />
            <Metric title="Booking OTP remaining" value={String(detail.verifiedBookingLedger.remaining)} />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <LedgerCard title="Current-month SMS credits" ledger={detail.smsLedger} />
            <LedgerCard title="Current-month verified-booking credits" ledger={detail.verifiedBookingLedger} />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-bold text-slate-950">Create billing request</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label>SKU</Label>
                <Select
                  value={requestForm.sku}
                  onValueChange={(sku) => setRequestForm((current) => ({ ...current, sku }))}
                >
                  <SelectTrigger className="mt-2 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {addons.map((addon) => (
                      <SelectItem key={addon.sku} value={addon.sku}>
                        {addon.sku} · {addon.units} units · {formatPhp(addon.pricePhp)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="requestQuantity">Quantity</Label>
                <Input
                  id="requestQuantity"
                  inputMode="numeric"
                  value={requestForm.quantity}
                  onChange={(event) =>
                    setRequestForm((current) => ({
                      ...current,
                      quantity: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="requestNotes">Notes</Label>
                <Textarea
                  id="requestNotes"
                  value={requestForm.notes}
                  onChange={(event) =>
                    setRequestForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <Button
              type="button"
              className="mt-4"
              disabled={submitting}
              onClick={() => void createBillingRequest()}
            >
              {submitting ? "Creating..." : "Create billing request"}
            </Button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-bold text-slate-950">SMS adjustment</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Adjustment type</Label>
                <Select
                  value={adjustmentForm.type}
                  onValueChange={(type: "promotional_grant" | "admin_correction") =>
                    setAdjustmentForm((current) => ({ ...current, type }))
                  }
                >
                  <SelectTrigger className="mt-2 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="promotional_grant">Promotional grant</SelectItem>
                    <SelectItem value="admin_correction">Admin correction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="adjustmentUnits">Units</Label>
                <Input
                  id="adjustmentUnits"
                  inputMode="numeric"
                  value={adjustmentForm.units}
                  onChange={(event) =>
                    setAdjustmentForm((current) => ({
                      ...current,
                      units: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="adjustmentReason">Reason</Label>
                <Textarea
                  id="adjustmentReason"
                  value={adjustmentForm.reason}
                  onChange={(event) =>
                    setAdjustmentForm((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <Button
              type="button"
              className="mt-4"
              disabled={submitting}
              onClick={() => void submitAdjustment()}
            >
              {submitting ? "Applying..." : "Apply SMS adjustment"}
            </Button>
          </section>

          <HistorySection title="Recent SMS add-ons" rows={detail.recentSmsAddons} />
          <HistorySection title="Recent usage" rows={[...detail.recentSmsUsage, ...detail.recentBookingUsage]} />
          <HistorySection title="Manual billing requests" rows={detail.billingRequests} />
          <HistorySection title="Payment history" rows={detail.payments} />
          <HistorySection title="Credit reconciliation history" rows={detail.reconciliation} />
        </>
      ) : null}
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
    </article>
  );
}

function LedgerCard({ title, ledger }: { title: string; ledger: { included: number; addon: number; used: number; remaining: number } }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-bold text-slate-950">{title}</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <p>Included: {ledger.included}</p>
        <p>Add-on: {ledger.addon}</p>
        <p>Used: {ledger.used}</p>
        <p>Remaining: {ledger.remaining}</p>
      </div>
    </section>
  );
}

function HistorySection({ title, rows }: { title: string; rows: Array<Record<string, unknown>> }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-bold text-slate-950">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">No records yet.</p>
      ) : (
        <div className="mt-4 grid gap-2">
          {rows.slice(0, 10).map((row, index) => (
            <div key={String(row.id ?? index)} className="rounded-xl border border-slate-200 p-3">
              <p className="break-words text-sm text-slate-700">
                {String(row.referenceNumber ?? row.sku ?? row.eventType ?? row.status ?? row.id ?? "Record")}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function readableError(err: unknown) {
  const body = (err as { responseBody?: Record<string, unknown> })?.responseBody;
  if (body?.code === "INSUFFICIENT_REMAINING_CREDITS") {
    return "Insufficient remaining credits for that correction.";
  }
  return err instanceof Error ? err.message : "Unable to complete action.";
}

function formatStatus(value: string) {
  return value.replace(/_/g, " ");
}

function formatPhp(amount: number) {
  return `₱${new Intl.NumberFormat("en-PH").format(amount)}`;
}
