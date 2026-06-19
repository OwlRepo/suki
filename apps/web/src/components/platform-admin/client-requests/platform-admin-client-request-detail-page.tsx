"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { StatusBanner } from "@/components/ui/status-banner";
import { Textarea } from "@/components/ui/textarea";
import {
  approvePlatformAdminClientBillingRequest,
  declinePlatformAdminClientBillingRequest,
  getPlatformAdminClientBillingRequest,
  startPlatformAdminClientBillingRequestReview,
  type PlatformAdminClientBillingRequest,
} from "./platform-admin-client-requests.api";

export function PlatformAdminClientRequestDetailPage({
  clientRequestId,
}: {
  clientRequestId: string;
}) {
  const [request, setRequest] =
    useState<PlatformAdminClientBillingRequest | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<
    "review" | "approve" | "decline" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRequest(await getPlatformAdminClientBillingRequest(clientRequestId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load request.");
    } finally {
      setLoading(false);
    }
  }, [clientRequestId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function runAction(nextAction: "review" | "approve" | "decline") {
    setAction(nextAction);
    setError(null);
    setMessage(null);
    try {
      const updated =
        nextAction === "review"
          ? await startPlatformAdminClientBillingRequestReview(clientRequestId)
          : nextAction === "approve"
            ? await approvePlatformAdminClientBillingRequest(clientRequestId, {
                decisionNote: decisionNote.trim() || null,
              })
            : await declinePlatformAdminClientBillingRequest(clientRequestId, {
                decisionNote: decisionNote.trim(),
              });
      setRequest(updated);
      setMessage(
        nextAction === "review"
          ? "Review started."
          : nextAction === "approve"
            ? "Request approved."
            : "Request declined.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update request.");
    } finally {
      setAction(null);
    }
  }

  const open =
    request?.status === "submitted" || request?.status === "under_review";

  return (
    <div className="w-full space-y-6 sm:space-y-8">
      <PageHeader
        title={request?.organizationName ?? "Client Request"}
        plainLanguageDescription="Validate client intent before creating any payable billing request."
        whatThisPageIsFor="Review requested billing change, client context, and current workflow state."
        whatToDoNext="Start review, leave a clear decision note, then approve or decline."
      />

      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <ListSkeleton rowCount={4} />
        </section>
      ) : null}
      {error ? <StatusBanner variant="error" message={error} /> : null}
      {message ? <StatusBanner variant="success" message={message} /> : null}
      {!loading && !error && !request ? (
        <EmptyState
          what="Client request not found"
          why="Request may have been removed or access may have changed."
        />
      ) : null}

      {!loading && request ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  {requestSummary(request)}
                </h2>
                <p className="mt-1 text-sm tabular-nums text-slate-600">
                  Submitted {formatDate(request.createdAt)}
                </p>
              </div>
              <Badge variant="outline">
                {request.status.replace(/_/g, " ")}
              </Badge>
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <Detail label="Request kind" value={request.kind.replace(/_/g, " ")} />
              <Detail label="Organization ID" value={request.organizationId} />
              <Detail label="Client note" value={request.note || "No note supplied"} />
              <Detail
                label="Reviewed"
                value={request.reviewedAt ? formatDate(request.reviewedAt) : "Not reviewed"}
              />
            </dl>
            {request.decisionNote ? (
              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-950">
                  Decision note
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  {request.decisionNote}
                </p>
              </div>
            ) : null}
            {request.linkedBillingRequestId ? (
              <Button asChild variant="outline" className="mt-5 w-full sm:w-auto">
                <Link
                  href={`/platform-admin/billing-requests/${request.linkedBillingRequestId}`}
                >
                  Open linked billing request
                </Link>
              </Button>
            ) : null}
          </section>

          {open ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-lg font-bold text-slate-950">Decision</h2>
              <p className="mt-1 max-w-[65ch] text-sm leading-6 text-slate-600">
                Approval creates existing manual billing request for plan changes
                and SMS top-ups. Cancellation approval records intent only.
              </p>
              <div className="mt-4">
                <Label htmlFor="client-request-decision-note">
                  Decision note
                </Label>
                <Textarea
                  id="client-request-decision-note"
                  className="mt-2"
                  value={decisionNote}
                  disabled={action !== null}
                  onChange={(event) => setDecisionNote(event.target.value)}
                  placeholder="Explain approval, next step, or decline reason."
                />
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {request.status === "submitted" ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={action !== null}
                    onClick={() => void runAction("review")}
                  >
                    {action === "review" ? "Starting review..." : "Start review"}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  disabled={
                    action !== null ||
                    (request.kind === "cancellation" && !decisionNote.trim())
                  }
                  onClick={() => void runAction("approve")}
                >
                  {action === "approve" ? "Approving..." : "Approve"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={action !== null || !decisionNote.trim()}
                  onClick={() => void runAction("decline")}
                >
                  {action === "decline" ? "Declining..." : "Decline"}
                </Button>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm text-slate-800">{value}</dd>
    </div>
  );
}

function requestSummary(request: PlatformAdminClientBillingRequest) {
  if (request.kind === "plan_change") {
    return `Plan change to ${request.requestedPlanType}`;
  }
  if (request.kind === "sms_topup") {
    return `${request.requestedQuantity} × ${request.requestedSku}`;
  }
  return "Paid plan cancellation";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
