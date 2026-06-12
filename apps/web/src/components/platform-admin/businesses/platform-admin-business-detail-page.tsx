"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import {
  createPlatformAdminBillingRequest,
  getPlatformAdminManualBillingCatalog,
  type ManualBillingCatalogItem,
} from "../billing/platform-admin-billing.api";
import {
  createSmsAdjustment,
  getPlatformAdminBillingAddons,
  getPlatformAdminBusiness,
  type PlatformAdminBusinessDetail,
  updatePlatformAdminBillingContact,
  updatePlatformAdminManualSubscriptionStatus,
} from "./platform-admin-businesses.api";

export function PlatformAdminBusinessDetailPage({
  organizationId,
}: {
  organizationId: string;
}) {
  const [detail, setDetail] = useState<PlatformAdminBusinessDetail | null>(null);
  const [addons, setAddons] = useState<Array<{ sku: string; units: number; pricePhp: number }>>([]);
  const [manualCatalog, setManualCatalog] = useState<ManualBillingCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
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
  const [subscriptionForm, setSubscriptionForm] = useState({
    sku: "starter-monthly",
    coverageStartsAt: "",
  });
  const [billingContactForm, setBillingContactForm] = useState({
    billingContactName: "",
    billingContactMobile: "",
    billingContactEmail: "",
    preferredPaymentMethod: "gcash" as
      | "gcash"
      | "bank_transfer"
      | "other",
  });
  const [lifecycleForm, setLifecycleForm] = useState({
    reason: "",
    graceUntil: "",
  });
  const [pendingLifecycleAction, setPendingLifecycleAction] = useState<
    | "mark_past_due"
    | "set_grace_until"
    | "suspend"
    | "reactivate"
    | "cancel"
    | null
  >(null);
  const [lifecycleSubmitting, setLifecycleSubmitting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setCatalogLoading(true);
    setError(null);
    try {
      const [business, addonResponse, catalogResponse] = await Promise.all([
        getPlatformAdminBusiness(organizationId),
        getPlatformAdminBillingAddons(),
        getPlatformAdminManualBillingCatalog(),
      ]);
      setDetail(business);
      setAddons(addonResponse.addons);
      setManualCatalog(
        catalogResponse.items.filter(
          (item) => item.purchaseKind === "subscription",
        ),
      );
      setBillingContactForm({
        billingContactName: business.organization.billingContactName ?? "",
        billingContactMobile:
          business.organization.billingContactMobile ?? "",
        billingContactEmail: business.organization.billingContactEmail ?? "",
        preferredPaymentMethod:
          business.organization.preferredPaymentMethod ?? "gcash",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load business");
    } finally {
      setLoading(false);
      setCatalogLoading(false);
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
      showBillingRequestCreated(response);
      await refresh();
    } catch (err) {
      setActionError(readableError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function createSubscriptionRequest() {
    setSubmitting(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const response = await createPlatformAdminBillingRequest({
        organizationId,
        sku: subscriptionForm.sku,
        quantity: 1,
        coverageStartsAt: subscriptionForm.coverageStartsAt
          ? new Date(subscriptionForm.coverageStartsAt).toISOString()
          : null,
      });
      showBillingRequestCreated(response);
      await refresh();
    } catch (err) {
      setActionError(readableError(err));
    } finally {
      setSubmitting(false);
    }
  }

  function showBillingRequestCreated(
    response: Awaited<ReturnType<typeof createPlatformAdminBillingRequest>>,
  ) {
    const reference = response.billingRequest.referenceNumber;
    const delivery = response.emailDelivery;
    if (delivery.status === "sent") {
      setActionMessage(
        `Created ${reference}. Payment request email sent to ${delivery.recipientEmail}.`,
      );
      return;
    }
    if (delivery.status === "skipped_missing_recipient") {
      setActionError(
        `Created ${reference}, but no billing contact email is configured. Open the request detail to retry after saving a recipient or copy the fallback instructions.`,
      );
      return;
    }
    if (delivery.status === "skipped_disabled") {
      setActionError(
        `Created ${reference}, but email controls are disabled. Copy fallback instructions remain available in the request detail.`,
      );
      return;
    }
    setActionError(
      `Created ${reference}, but the payment request email was not sent. Open the request detail to retry or copy the fallback instructions.`,
    );
  }

  async function saveBillingContact() {
    setSubmitting(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await updatePlatformAdminBillingContact(organizationId, {
        billingContactName: billingContactForm.billingContactName || null,
        billingContactMobile: billingContactForm.billingContactMobile || null,
        billingContactEmail: billingContactForm.billingContactEmail || null,
        preferredPaymentMethod: billingContactForm.preferredPaymentMethod,
      });
      setActionMessage("Billing contact saved.");
      await refresh();
    } catch (err) {
      setActionError(readableError(err));
    } finally {
      setSubmitting(false);
    }
  }

  function requestLifecycleAction(
    action:
      | "mark_past_due"
      | "set_grace_until"
      | "suspend"
      | "reactivate"
      | "cancel",
  ) {
    if (!lifecycleForm.reason.trim()) {
      setActionError("Reason is required for lifecycle actions.");
      return;
    }
    if (action === "set_grace_until" && !lifecycleForm.graceUntil) {
      setActionError("Grace-until date is required.");
      return;
    }
    setActionError(null);
    setPendingLifecycleAction(action);
  }

  async function submitLifecycleAction() {
    if (!pendingLifecycleAction) return;
    setLifecycleSubmitting(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await updatePlatformAdminManualSubscriptionStatus(organizationId, {
        action: pendingLifecycleAction,
        graceUntil:
          pendingLifecycleAction === "set_grace_until"
            ? new Date(lifecycleForm.graceUntil).toISOString()
            : null,
        reason: lifecycleForm.reason.trim(),
      });
      setActionMessage(
        `${formatStatus(pendingLifecycleAction)} completed successfully.`,
      );
      setPendingLifecycleAction(null);
      await refresh();
    } catch (err) {
      setActionError(readableError(err));
    } finally {
      setLifecycleSubmitting(false);
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

  const manualBillingControlsEnabled =
    Boolean(detail?.manualBillingControlsEnabled) &&
    !catalogLoading;
  const selectedSubscription = manualCatalog.find(
    (item) => item.sku === subscriptionForm.sku,
  );

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
            disabled={loading}
            className="w-full gap-2 sm:w-auto"
          >
            <RefreshCw className="size-4" />
            {loading ? "Refreshing..." : "Refresh"}
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
      {!loading && detail && !manualBillingControlsEnabled ? (
        <StatusBanner
          variant="warning"
          message="Manual billing controls are disabled. Review is available, but billing changes cannot be submitted."
        />
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
            <h2 className="text-lg font-bold text-slate-950">Manual Subscription</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailValue
                label="Current plan"
                value={detail.organization.currentPlan ?? "free"}
              />
              <DetailValue
                label="Current billing status"
                value={formatStatus(
                  detail.organization.billingStatus ?? "free_active",
                )}
              />
              <DetailValue
                label="Access end"
                value={formatDate(detail.organization.accessEndsAt)}
              />
              <DetailValue
                label="Next billing due"
                value={formatDate(detail.organization.nextBillingDueAt)}
              />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Target plan</Label>
                <Select
                  value={subscriptionForm.sku}
                  onValueChange={(sku) =>
                    setSubscriptionForm((current) => ({ ...current, sku }))
                  }
                  disabled={catalogLoading || manualCatalog.length === 0}
                >
                  <SelectTrigger className="mt-2 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {manualCatalog.map((item) => (
                      <SelectItem key={item.sku} value={item.sku}>
                        {item.planType} monthly · {formatPhp(item.pricePhp)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="coverageStartsAt">
                  Coverage start date (optional)
                </Label>
                <Input
                  id="coverageStartsAt"
                  type="datetime-local"
                  value={subscriptionForm.coverageStartsAt}
                  onChange={(event) =>
                    setSubscriptionForm((current) => ({
                      ...current,
                      coverageStartsAt: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Canonical amount:{" "}
              {selectedSubscription
                ? formatPhp(selectedSubscription.pricePhp)
                : "Catalog unavailable"}
            </p>
            <Button
              type="button"
              className="mt-4"
              disabled={
                submitting ||
                !manualBillingControlsEnabled ||
                !selectedSubscription
              }
              onClick={() => void createSubscriptionRequest()}
            >
              {submitting ? "Creating..." : "Create subscription request"}
            </Button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-bold text-slate-950">Billing Contact</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="billingContactName">Billing contact name</Label>
                <Input
                  id="billingContactName"
                  value={billingContactForm.billingContactName}
                  onChange={(event) =>
                    setBillingContactForm((current) => ({
                      ...current,
                      billingContactName: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="billingContactMobile">Billing contact mobile</Label>
                <Input
                  id="billingContactMobile"
                  placeholder="+639171234567"
                  value={billingContactForm.billingContactMobile}
                  onChange={(event) =>
                    setBillingContactForm((current) => ({
                      ...current,
                      billingContactMobile: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="billingContactEmail">Billing contact email</Label>
                <Input
                  id="billingContactEmail"
                  type="email"
                  value={billingContactForm.billingContactEmail}
                  onChange={(event) =>
                    setBillingContactForm((current) => ({
                      ...current,
                      billingContactEmail: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label>Preferred payment method</Label>
                <Select
                  value={billingContactForm.preferredPaymentMethod}
                  onValueChange={(
                    preferredPaymentMethod:
                      | "gcash"
                      | "bank_transfer"
                      | "other",
                  ) =>
                    setBillingContactForm((current) => ({
                      ...current,
                      preferredPaymentMethod,
                    }))
                  }
                >
                  <SelectTrigger className="mt-2 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gcash">GCash</SelectItem>
                    <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              type="button"
              className="mt-4"
              disabled={submitting || !manualBillingControlsEnabled}
              onClick={() => void saveBillingContact()}
            >
              {submitting ? "Saving..." : "Save billing contact"}
            </Button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-bold text-slate-950">Lifecycle Actions</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="lifecycleReason">Reason</Label>
                <Textarea
                  id="lifecycleReason"
                  value={lifecycleForm.reason}
                  onChange={(event) =>
                    setLifecycleForm((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="graceUntil">Grace-until date</Label>
                <Input
                  id="graceUntil"
                  type="datetime-local"
                  value={lifecycleForm.graceUntil}
                  onChange={(event) =>
                    setLifecycleForm((current) => ({
                      ...current,
                      graceUntil: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                ["mark_past_due", "Mark past due"],
                ["set_grace_until", "Set grace period"],
                ["suspend", "Suspend"],
                ["reactivate", "Reactivate"],
                ["cancel", "Cancel"],
              ].map(([action, label]) => (
                <Button
                  key={action}
                  type="button"
                  variant={action === "cancel" ? "destructive" : "outline"}
                  disabled={
                    lifecycleSubmitting || !manualBillingControlsEnabled
                  }
                  onClick={() =>
                    requestLifecycleAction(
                      action as
                        | "mark_past_due"
                        | "set_grace_until"
                        | "suspend"
                        | "reactivate"
                        | "cancel",
                    )
                  }
                >
                  {label}
                </Button>
              ))}
            </div>
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
              disabled={submitting || !manualBillingControlsEnabled}
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
              disabled={submitting || !manualBillingControlsEnabled}
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

      <ConfirmDialog
        open={Boolean(pendingLifecycleAction)}
        onOpenChange={(open) => !open && setPendingLifecycleAction(null)}
        title="Confirm lifecycle action"
        description={`Apply ${formatStatus(
          pendingLifecycleAction ?? "",
        )} to this manual subscription?`}
        confirmLabel={
          lifecycleSubmitting ? "Applying..." : "Confirm lifecycle action"
        }
        destructive={
          pendingLifecycleAction === "suspend" ||
          pendingLifecycleAction === "cancel"
        }
        onConfirm={submitLifecycleAction}
      />
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

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="mt-1 text-sm text-slate-950">{value}</p>
    </div>
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

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
