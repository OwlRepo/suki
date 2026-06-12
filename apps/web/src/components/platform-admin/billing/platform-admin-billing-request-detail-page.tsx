"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { ListSkeleton, MetricGridSkeleton } from "@/components/ui/skeleton";
import { StatusBanner } from "@/components/ui/status-banner";
import { Textarea } from "@/components/ui/textarea";
import {
  confirmManualPaymentAndFulfill,
  getPlatformAdminBillingRequest,
  recordManualPayment,
  rejectManualPayment,
  sendPlatformAdminPaymentAcknowledgmentEmail,
  sendPlatformAdminPaymentRequestEmail,
  voidBillingRequest,
  type BillingRequestDetail,
  type ManualBillingEmailDelivery,
} from "./platform-admin-billing.api";

export function PlatformAdminBillingRequestDetailPage({
  billingRequestId,
}: {
  billingRequestId: string;
}) {
  const [detail, setDetail] = useState<BillingRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [confirmPaymentId, setConfirmPaymentId] = useState<string | null>(null);
  const [rejectPaymentId, setRejectPaymentId] = useState<string | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [resending, setResending] = useState<
    "payment_request" | "payment_acknowledgment" | null
  >(null);
  const [paymentForm, setPaymentForm] = useState({
    method: "gcash" as "gcash" | "bank_transfer" | "other",
    amountPhp: "",
    externalReference: "",
    notes: "",
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await getPlatformAdminBillingRequest(billingRequestId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load request");
    } finally {
      setLoading(false);
    }
  }, [billingRequestId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function submitPayment() {
    if (!detail) return;
    setRecording(true);
    setActionError(null);
    setActionMessage(null);
    try {
      setDetail(
        await recordManualPayment(detail.id, {
          method: paymentForm.method,
          amountPhp: Number(paymentForm.amountPhp),
          externalReference: paymentForm.externalReference || null,
          notes: paymentForm.notes || null,
        }),
      );
      setPaymentForm({
        method: "gcash",
        amountPhp: "",
        externalReference: "",
        notes: "",
      });
      setActionMessage("Payment recorded.");
    } catch (err) {
      setActionError(readableError(err));
    } finally {
      setRecording(false);
    }
  }

  async function confirmPayment(paymentId: string) {
    setActionError(null);
    setActionMessage(null);
    try {
      const fulfilled = await confirmManualPaymentAndFulfill(paymentId);
      setDetail(fulfilled);
      setActionMessage("Payment confirmed and fulfillment completed.");
      const acknowledgment =
        fulfilled.latestPaymentAcknowledgmentEmailDelivery;
      if (acknowledgment?.status === "sent") {
        setActionMessage(
          "Payment confirmed and fulfillment completed. Payment acknowledgment email sent.",
        );
      } else if (acknowledgment) {
        setActionError(
          "Payment was verified and fulfillment completed, but the payment acknowledgment email was not sent. Copy fallback remains available.",
        );
      }
    } catch (err) {
      setActionError(readableError(err));
    }
  }

  async function resendEmail(
    kind: "payment_request" | "payment_acknowledgment",
  ) {
    if (!detail) return;
    setResending(kind);
    setActionError(null);
    setActionMessage(null);
    try {
      const delivery =
        kind === "payment_request"
          ? await sendPlatformAdminPaymentRequestEmail(detail.id)
          : await sendPlatformAdminPaymentAcknowledgmentEmail(detail.id);
      setDetail((current) =>
        current ? addEmailDelivery(current, delivery) : current,
      );
      if (delivery.status === "sent") {
        setActionMessage(
          kind === "payment_request"
            ? "Payment request email sent."
            : "Payment acknowledgment email sent.",
        );
      } else {
        setActionError(
          `${kind === "payment_request" ? "Payment request" : "Payment acknowledgment"} email was not sent: ${deliveryStatusLabel(delivery)}. Copy fallback remains available.`,
        );
      }
    } catch (err) {
      setActionError(
        `${kind === "payment_request" ? "Payment request" : "Payment acknowledgment"} resend failed. ${readableError(err)}`,
      );
    } finally {
      setResending(null);
    }
  }

  async function rejectPayment(paymentId: string) {
    setActionError(null);
    setActionMessage(null);
    try {
      setDetail(await rejectManualPayment(paymentId));
      setActionMessage("Payment rejected.");
    } catch (err) {
      setActionError(readableError(err));
    }
  }

  async function voidRequest() {
    if (!detail) return;
    setActionError(null);
    setActionMessage(null);
    try {
      setDetail(await voidBillingRequest(detail.id));
      setActionMessage("Billing request voided.");
    } catch (err) {
      setActionError(readableError(err));
    }
  }

  return (
    <div className="w-full space-y-6 sm:space-y-8">
      <PageHeader
        title={detail?.referenceNumber ?? "Billing Request"}
        plainLanguageDescription="Verify the reported payment before applying credits."
        whatThisPageIsFor="Review the SKU snapshot, payment record, and fulfillment state for this manual request."
        whatToDoNext="Record payment when a customer reports it, then confirm and fulfill only after the exact amount is verified."
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
          <h2 className="text-base font-bold text-slate-950">
            Loading billing request
          </h2>
          <MetricGridSkeleton count={3} className="mt-4" />
          <ListSkeleton rowCount={3} className="mt-4" />
        </section>
      ) : null}

      {error ? (
        <div className="space-y-3">
          <StatusBanner
            variant="error"
            message={error}
            onDismiss={() => setError(null)}
          />
          <div>
            <Button type="button" variant="outline" onClick={() => void refresh()}>
              Retry
            </Button>
          </div>
        </div>
      ) : null}

      {actionError ? (
        <StatusBanner
          variant="error"
          message={actionError}
          onDismiss={() => setActionError(null)}
        />
      ) : null}
      {actionMessage ? (
        <StatusBanner
          variant="success"
          message={actionMessage}
          onDismiss={() => setActionMessage(null)}
        />
      ) : null}
      {!loading &&
      detail &&
      detail.manualBillingControlsEnabled === false ? (
        <StatusBanner
          variant="warning"
          message="Manual billing controls are disabled. Review is available, but billing changes cannot be submitted."
        />
      ) : null}

      {!loading && !error && !detail ? (
        <EmptyState
          what="Billing request not found"
          why="The request may have been deleted or you may not have access to it."
          nextAction={
            <Button type="button" variant="outline" onClick={() => void refresh()}>
              Retry
            </Button>
          }
        />
      ) : null}

      {!loading && !error && detail ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  {detail.organizationName}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Total amount: {formatPhp(detail.totalAmountPhp)}
                </p>
              </div>
              <Badge variant="outline">{formatStatus(detail.status)}</Badge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {detail.items.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-950">{item.sku}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {item.purchaseKind === "subscription"
                      ? `${item.planType ?? "Unknown"} · ${formatStatus(
                          item.billingInterval ?? "Unknown",
                        )}`
                      : `${formatStatus(item.purchaseKind)} · ${item.units} units × ${item.quantity}`}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {formatPhp(item.unitPricePhp)} each
                  </p>
                  {item.purchaseKind === "subscription" ? (
                    <p className="mt-1 text-sm text-slate-600">
                      Coverage: {formatDate(item.coverageStartsAt)} to{" "}
                      {formatDate(item.coverageEndsAt)}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <BillingEmailDeliverySection
            detail={detail}
            resending={resending}
            onResend={resendEmail}
          />

          {detail.status === "paid_and_fulfilled" ? (
            <PaymentAcknowledgment detail={detail} />
          ) : null}

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Payment instructions
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Send this text only to the customer contact handling the manual payment.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 sm:w-auto"
                onClick={() =>
                  navigator.clipboard?.writeText(detail.paymentInstructions.copyText)
                }
              >
                <Copy className="size-4" />
                Copy
              </Button>
            </div>
            <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              {detail.paymentInstructions.copyText}
            </pre>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-bold text-slate-950">Record payment</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="amountPhp">Amount in PHP</Label>
                <Input
                  id="amountPhp"
                  inputMode="numeric"
                  value={paymentForm.amountPhp}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      amountPhp: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="externalReference">Payment reference</Label>
                <Input
                  id="externalReference"
                  value={paymentForm.externalReference}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      externalReference: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="paymentNotes">Notes</Label>
                <Textarea
                  id="paymentNotes"
                  value={paymentForm.notes}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <Button
              type="button"
              className="mt-4 w-full sm:w-auto"
              disabled={
                recording || detail.manualBillingControlsEnabled === false
              }
              onClick={() => void submitPayment()}
            >
              {recording ? "Recording..." : "Record payment"}
            </Button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Reported payment
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Confirm only after the received amount exactly matches the request total.
                </p>
              </div>
            </div>
            {detail.payments.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">
                No payment has been recorded yet.
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {detail.payments.map((payment) => (
                  <div key={payment.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-semibold text-slate-950">
                        {formatPhp(payment.amountPhp)} via {formatStatus(payment.method)}
                      </p>
                      <Badge variant="outline">{payment.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      Reference: {payment.externalReference || "Not provided"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={
                          payment.status !== "pending" ||
                          detail.manualBillingControlsEnabled === false
                        }
                        onClick={() => setConfirmPaymentId(payment.id)}
                      >
                        Confirm payment
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                          payment.status !== "pending" ||
                          detail.manualBillingControlsEnabled === false
                        }
                        onClick={() => setRejectPaymentId(payment.id)}
                      >
                        Reject payment
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-bold text-slate-950">Audit history</h2>
            {detail.auditLogs.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">
                Sensitive actions for this organization will appear here.
              </p>
            ) : (
              <div className="mt-4 grid gap-2">
                {detail.auditLogs.map((log, index) => (
                  <p key={String(log.id ?? index)} className="text-sm text-slate-700">
                    {String(log.action ?? "audit event")}
                  </p>
                ))}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              disabled={
                detail.status === "paid_and_fulfilled" ||
                detail.manualBillingControlsEnabled === false
              }
              onClick={() => setVoidOpen(true)}
            >
              Void request
            </Button>
          </section>
        </>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmPaymentId)}
        onOpenChange={(open) => !open && setConfirmPaymentId(null)}
        title="Confirm payment and fulfill"
        description="This verifies the payment and applies the credits exactly once."
        confirmLabel="Confirm and fulfill"
        onConfirm={async () => {
          if (confirmPaymentId) await confirmPayment(confirmPaymentId);
        }}
      />
      <ConfirmDialog
        open={Boolean(rejectPaymentId)}
        onOpenChange={(open) => !open && setRejectPaymentId(null)}
        title="Reject payment"
        description="This marks the reported payment rejected and does not apply credits."
        confirmLabel="Reject payment"
        destructive
        onConfirm={async () => {
          if (rejectPaymentId) await rejectPayment(rejectPaymentId);
        }}
      />
      <ConfirmDialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        title="Void billing request"
        description="This stops finance from using this request for payment verification."
        confirmLabel="Void request"
        destructive
        onConfirm={voidRequest}
      />
    </div>
  );
}

function BillingEmailDeliverySection({
  detail,
  resending,
  onResend,
}: {
  detail: BillingRequestDetail;
  resending: "payment_request" | "payment_acknowledgment" | null;
  onResend: (
    kind: "payment_request" | "payment_acknowledgment",
  ) => Promise<void>;
}) {
  const requestDelivery = detail.latestPaymentRequestEmailDelivery ?? null;
  const acknowledgmentDelivery =
    detail.latestPaymentAcknowledgmentEmailDelivery ?? null;
  const hasVerifiedPayment = detail.payments.some(
    (payment) => payment.status === "verified",
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-bold text-slate-950">
        Billing email delivery
      </h2>
      {!detail.emailDeliveries.length ? (
        <p className="mt-2 text-sm text-slate-600">No email attempts yet.</p>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <DeliverySummary
          label="Payment request"
          delivery={requestDelivery}
          buttonLabel={
            requestDelivery
              ? "Resend payment request email"
              : "Send payment request email"
          }
          pending={resending === "payment_request"}
          disabled={detail.manualBillingControlsEnabled === false}
          onSend={() => onResend("payment_request")}
        />
        {detail.status === "paid_and_fulfilled" || hasVerifiedPayment ? (
          <DeliverySummary
            label="Payment acknowledgment"
            delivery={acknowledgmentDelivery}
            buttonLabel={
              acknowledgmentDelivery
                ? "Resend acknowledgment"
                : "Send acknowledgment"
            }
            pending={resending === "payment_acknowledgment"}
            disabled={detail.manualBillingControlsEnabled === false}
            onSend={() => onResend("payment_acknowledgment")}
          />
        ) : null}
      </div>

      {detail.emailDeliveries.length ? (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-950">
            Delivery history
          </h3>
          <div className="mt-2 grid gap-2">
            {detail.emailDeliveries.map((delivery) => (
              <div
                key={delivery.id}
                className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700"
              >
                <p className="font-semibold text-slate-950">
                  {delivery.kind === "payment_request"
                    ? "Payment request"
                    : "Payment acknowledgment"}{" "}
                  - {deliveryStatusLabel(delivery)}
                </p>
                <p className="mt-1">
                  {delivery.recipientEmail ?? "No recipient"} ·{" "}
                  {formatDateTime(delivery.attemptedAt)}
                </p>
                {delivery.failureReason ? (
                  <p className="mt-1">
                    {formatStatus(delivery.failureReason)}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DeliverySummary({
  label,
  delivery,
  buttonLabel,
  pending,
  disabled,
  onSend,
}: {
  label: string;
  delivery: ManualBillingEmailDelivery | null;
  buttonLabel: string;
  pending: boolean;
  disabled: boolean;
  onSend: () => Promise<void>;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-sm font-semibold text-slate-950">
        {label}: {delivery ? deliveryStatusLabel(delivery) : "No attempt"}
      </p>
      {delivery?.recipientEmail ? (
        <p className="mt-1 text-sm text-slate-600">
          {delivery.recipientEmail}
        </p>
      ) : null}
      {delivery?.attemptedAt ? (
        <p className="mt-1 text-sm text-slate-600">
          Last attempted: {formatDateTime(delivery.attemptedAt)}
        </p>
      ) : null}
      {delivery?.failureReason ? (
        <p className="mt-1 text-sm text-rose-700">
          {formatStatus(delivery.failureReason)}
        </p>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-3"
        disabled={disabled || pending}
        onClick={() => void onSend()}
      >
        {pending ? "Sending..." : buttonLabel}
      </Button>
    </div>
  );
}

function addEmailDelivery(
  detail: BillingRequestDetail,
  delivery: ManualBillingEmailDelivery,
): BillingRequestDetail {
  return {
    ...detail,
    emailDeliveries: [delivery, ...detail.emailDeliveries],
    ...(delivery.kind === "payment_request"
      ? { latestPaymentRequestEmailDelivery: delivery }
      : { latestPaymentAcknowledgmentEmailDelivery: delivery }),
  };
}

function deliveryStatusLabel(delivery: ManualBillingEmailDelivery) {
  if (delivery.status === "skipped_missing_recipient") {
    return "Missing recipient";
  }
  if (delivery.status === "skipped_disabled") return "Disabled";
  return formatStatus(delivery.status);
}

function PaymentAcknowledgment({
  detail,
}: {
  detail: BillingRequestDetail;
}) {
  const item = detail.items[0];
  const verifiedPayment = detail.payments.find(
    (payment) => payment.status === "verified",
  );
  if (!item || !verifiedPayment) return null;
  const isSubscription = item.purchaseKind === "subscription";
  const fulfillmentStatus = isSubscription
    ? "Paid and activated"
    : "Paid and fulfilled";
  const copyText = [
    "Payment acknowledgment",
    `Reference: ${detail.referenceNumber}`,
    `Business: ${detail.organizationName}`,
    isSubscription
      ? `Plan: ${item.planType ?? item.sku}`
      : `Package: ${item.sku}`,
    `Amount received: ${formatPhp(verifiedPayment.amountPhp)}`,
    ...(isSubscription
      ? [
          `Coverage: ${formatDate(item.coverageStartsAt)} to ${formatDate(
            item.coverageEndsAt,
          )}`,
        ]
      : []),
    `Status: ${fulfillmentStatus}`,
    isSubscription ? "Subscription activated" : "Credits applied",
  ].join("\n");

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-950">
            Payment acknowledgment
          </h2>
          <p className="mt-1 text-sm text-slate-600">{fulfillmentStatus}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2 sm:w-auto"
          onClick={() => navigator.clipboard?.writeText(copyText)}
        >
          <Copy className="size-4" />
          Copy acknowledgment
        </Button>
      </div>
      <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
        {copyText}
      </pre>
    </section>
  );
}

function readableError(err: unknown) {
  const body = (err as { responseBody?: Record<string, unknown> })?.responseBody;
  if (body?.code === "PAYMENT_AMOUNT_MISMATCH") {
    return `Payment amount mismatch. Expected ${formatPhp(Number(body.expectedAmountPhp))}; received ${formatPhp(Number(body.receivedAmountPhp))}.`;
  }
  if (body?.code === "ALREADY_FULFILLED") {
    return "This request has already been fulfilled. No duplicate credits were applied.";
  }
  if (body?.code === "INVALID_REQUEST_STATUS") {
    return "This request is not in a status that allows that action.";
  }
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
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}
