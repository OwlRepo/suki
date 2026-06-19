"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ClientBillingRequestKind,
  PlanType,
} from "@tyvera/types";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { StatusBanner } from "@/components/ui/status-banner";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelClientBillingRequest,
  createClientBillingRequest,
  listClientBillingRequests,
  type ClientBillingRequest,
} from "./client-billing-requests.api";

const SMS_PACKS = [
  { sku: "sms-segment-topup-25", label: "25 SMS segments" },
  { sku: "sms-segment-topup-50", label: "50 SMS segments" },
  { sku: "sms-segment-topup-100", label: "100 SMS segments" },
  { sku: "sms-segment-topup-250", label: "250 SMS segments" },
];

export function RequestChangeSection({
  currentPlan,
  readOnly,
}: {
  currentPlan: PlanType;
  readOnly: boolean;
}) {
  const { getToken } = useAuth();
  const [requests, setRequests] = useState<ClientBillingRequest[]>([]);
  const [kind, setKind] =
    useState<ClientBillingRequestKind>("plan_change");
  const [plan, setPlan] = useState<Exclude<PlanType, "free">>("growth");
  const [sku, setSku] = useState(SMS_PACKS[0].sku);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const paidPlans = useMemo(
    () =>
      (["starter", "growth", "pro"] as const).filter(
        (candidate) => candidate !== currentPlan,
      ),
    [currentPlan],
  );

  useEffect(() => {
    if (!paidPlans.includes(plan)) setPlan(paidPlans[0] ?? "starter");
  }, [paidPlans, plan]);

  const refresh = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const response = await listClientBillingRequests(token);
      setRequests(response.clientBillingRequests);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load requests.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const token = await getToken();
      if (!token) return;
      await createClientBillingRequest(token, {
        kind,
        requestedPlanType: kind === "plan_change" ? plan : null,
        requestedSku: kind === "sms_topup" ? sku : null,
        requestedQuantity: kind === "sms_topup" ? quantity : null,
        note: note.trim() || null,
      });
      setNote("");
      setMessage("Request sent to Tyvera billing.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send request.");
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel(requestId: string) {
    setCancellingId(requestId);
    setError(null);
    setMessage(null);
    try {
      const token = await getToken();
      if (!token) return;
      await cancelClientBillingRequest(token, requestId);
      setMessage("Request cancelled.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to cancel request.");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <section
      id="billing-request-section"
      aria-labelledby="billing-request-heading"
      className="scroll-mt-6 space-y-4"
    >
      <div>
        <h2 id="billing-request-heading" className="text-xl font-semibold">
          Request billing help
        </h2>
        <p className="mt-1 max-w-[65ch] text-sm text-muted-foreground">
          Send plan changes, SMS top-ups, or cancellation requests to Tyvera.
          Billing staff will review before any paid request is created.
        </p>
      </div>

      {error ? <StatusBanner variant="error" message={error} /> : null}
      {message ? <StatusBanner variant="success" message={message} /> : null}

      {!readOnly ? (
        <Card className="gap-5 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="billing-request-kind">Request type</Label>
              <select
                id="billing-request-kind"
                className="mt-2 min-h-[44px] w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                value={kind}
                disabled={submitting}
                onChange={(event) =>
                  setKind(event.target.value as ClientBillingRequestKind)
                }
              >
                <option value="plan_change">Change paid plan</option>
                <option value="sms_topup">Buy SMS top-up</option>
                {currentPlan !== "free" ? (
                  <option value="cancellation">Cancel paid plan</option>
                ) : null}
              </select>
            </div>

            {kind === "plan_change" ? (
              <div>
                <Label htmlFor="requested-plan">Requested plan</Label>
                <select
                  id="requested-plan"
                  className="mt-2 min-h-[44px] w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  value={plan}
                  disabled={submitting}
                  onChange={(event) =>
                    setPlan(
                      event.target.value as Exclude<PlanType, "free">,
                    )
                  }
                >
                  {paidPlans.map((candidate) => (
                    <option key={candidate} value={candidate}>
                      {capitalize(candidate)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {kind === "sms_topup" ? (
              <>
                <div>
                  <Label htmlFor="requested-sms-pack">SMS package</Label>
                  <select
                    id="requested-sms-pack"
                    className="mt-2 min-h-[44px] w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    value={sku}
                    disabled={submitting}
                    onChange={(event) => setSku(event.target.value)}
                  >
                    {SMS_PACKS.map((pack) => (
                      <option key={pack.sku} value={pack.sku}>
                        {pack.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="requested-sms-quantity">Quantity</Label>
                  <input
                    id="requested-sms-quantity"
                    type="number"
                    min={1}
                    step={1}
                    className="mt-2 min-h-[44px] w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    value={quantity}
                    disabled={submitting}
                    onChange={(event) =>
                      setQuantity(Math.max(1, Number(event.target.value)))
                    }
                  />
                </div>
              </>
            ) : null}
          </div>

          <div>
            <Label htmlFor="billing-request-note">
              Note {kind === "cancellation" ? "(recommended)" : "(optional)"}
            </Label>
            <Textarea
              id="billing-request-note"
              className="mt-2"
              value={note}
              disabled={submitting}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Add timing, context, or a preferred contact method."
            />
          </div>

          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={submitting || (kind === "plan_change" && paidPlans.length === 0)}
            onClick={() => void submit()}
          >
            {submitting ? "Sending request..." : "Send billing request"}
          </Button>
        </Card>
      ) : null}

      <div aria-live="polite">
        <h3 className="text-base font-semibold">Recent requests</h3>
        {loading ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Loading requests...
          </p>
        ) : requests.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No billing requests yet.
          </p>
        ) : (
          <div className="mt-3 grid gap-3">
            {requests.map((request) => {
              const open =
                request.status === "submitted" ||
                request.status === "under_review";
              return (
                <Card key={request.id} className="gap-3 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium">
                        {requestSummary(request)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Sent{" "}
                        {new Date(request.createdAt).toLocaleDateString("en-PH")}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {request.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  {request.note ? (
                    <p className="text-sm text-muted-foreground">
                      Your note: {request.note}
                    </p>
                  ) : null}
                  {request.decisionNote ? (
                    <p className="rounded-lg bg-muted px-3 py-2 text-sm">
                      Tyvera response: {request.decisionNote}
                    </p>
                  ) : null}
                  {!readOnly && open ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={cancellingId === request.id}
                      onClick={() => void cancel(request.id)}
                    >
                      {cancellingId === request.id
                        ? "Cancelling..."
                        : "Cancel request"}
                    </Button>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function requestSummary(request: ClientBillingRequest) {
  if (request.kind === "plan_change") {
    return `Plan change to ${capitalize(request.requestedPlanType ?? "")}`;
  }
  if (request.kind === "sms_topup") {
    return `${request.requestedQuantity ?? 1} × ${request.requestedSku ?? "SMS top-up"}`;
  }
  return "Plan cancellation";
}

function capitalize(value: string) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}
