"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
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
import {
  getPlatformAdminCommunicationDetail,
  getPlatformAdminCommunicationsSummary,
  listPlatformAdminCommunications,
} from "./platform-admin-communications.api";
import { PlatformAdminMessageDetailDrawer } from "./platform-admin-message-detail-drawer";
import type {
  CommunicationChannel,
  CommunicationsRange,
  DeliveryStatus,
  PlatformAdminCommunicationDetail,
  PlatformAdminCommunicationFilters,
  PlatformAdminCommunicationListItem,
  PlatformAdminCommunicationsSummary,
} from "./platform-admin-communications.types";

const VOLUME_CHART_CONFIG = {
  smsSent: { label: "SMS sent", color: "var(--color-chart-1)" },
  emailDelivered: { label: "Email delivered", color: "var(--color-chart-2)" },
} satisfies ChartConfig;

const FAILURE_CHART_CONFIG = {
  smsFailed: { label: "SMS failed", color: "var(--color-chart-3)" },
  emailFailed: { label: "Email failed", color: "var(--color-chart-4)" },
  otpFailures: { label: "OTP failures", color: "var(--color-chart-5)" },
} satisfies ChartConfig;

export function PlatformAdminCommunicationsPage() {
  const [summary, setSummary] = useState<PlatformAdminCommunicationsSummary | null>(null);
  const [messages, setMessages] = useState<PlatformAdminCommunicationListItem[]>([]);
  const [filters, setFilters] = useState<PlatformAdminCommunicationFilters>({
    range: "24h",
    limit: 25,
  });
  const [draftFilters, setDraftFilters] = useState<PlatformAdminCommunicationFilters>({
    range: "24h",
    limit: 25,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PlatformAdminCommunicationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const refresh = useCallback(async (nextFilters = filters) => {
    setLoading(true);
    setError(null);
    try {
      const [summaryResponse, listResponse] = await Promise.all([
        getPlatformAdminCommunicationsSummary({
          range: nextFilters.range,
          organizationId: nextFilters.organizationId,
          businessId: nextFilters.businessId,
        }),
        listPlatformAdminCommunications(nextFilters),
      ]);
      setSummary(summaryResponse);
      setMessages(listResponse.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load communications");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void refresh(filters);
  }, [refresh, filters]);

  const chartData = useMemo(
    () =>
      (summary?.series ?? []).map((point) => ({
        ...point,
        label: formatBucket(point.bucket, summary?.range ?? "24h"),
      })),
    [summary],
  );

  async function openDetail(messageId: string) {
    setSelectedMessageId(messageId);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      setDetail(await getPlatformAdminCommunicationDetail(messageId));
    } catch (err) {
      setDetailError(
        err instanceof Error ? err.message : "Unable to load message details",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  function applyFilters() {
    const next = cleanFilters({ ...draftFilters, page: 1, limit: 25 });
    setFilters(next);
    void refresh(next);
  }

  return (
    <div className="w-full space-y-6 sm:space-y-8">
      <PageHeader
        title="Communications"
        plainLanguageDescription="Review how Tyvera SMS and email messages are sending."
        whatThisPageIsFor="See failed messages, delivery trends, and reminders that may need manual follow-up."
        whatToDoNext="Check failure spikes first, then open individual messages that need investigation."
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
            Loading communications
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Checking delivery totals, failure trends, and recent messages.
          </p>
          <MetricGridSkeleton count={6} className="mt-4" />
          <ListSkeleton rowCount={5} className="mt-5" />
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

      {!loading && !error && summary ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <SummaryCard label="SMS sent" value={summary.totals.smsSent} />
            <SummaryCard label="SMS failed" value={summary.totals.smsFailed} />
            <SummaryCard label="Email delivered" value={summary.totals.emailDelivered} />
            <SummaryCard label="Email failed" value={summary.totals.emailFailed} />
            <SummaryCard label="Open manual follow-ups" value={summary.totals.openManualFollowUps} />
            <SummaryCard label="OTP failures" value={summary.totals.otpSendFailures} />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2">
                <Label>Range</Label>
                <Select
                  value={draftFilters.range ?? "24h"}
                  onValueChange={(value) =>
                    setDraftFilters((current) => ({
                      ...current,
                      range: value as CommunicationsRange,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">Last 24 hours</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Channel</Label>
                <Select
                  value={draftFilters.channel ?? "all"}
                  onValueChange={(value) =>
                    setDraftFilters((current) => ({
                      ...current,
                      channel: value === "all" ? undefined : (value as CommunicationChannel),
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All channels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All channels</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Delivery status</Label>
                <Select
                  value={draftFilters.deliveryStatus ?? "all"}
                  onValueChange={(value) =>
                    setDraftFilters((current) => ({
                      ...current,
                      deliveryStatus: value === "all" ? undefined : (value as DeliveryStatus),
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="queued">Queued</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="bounced">Bounced</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Input
                  id="provider"
                  value={draftFilters.provider ?? ""}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      provider: event.target.value,
                    }))
                  }
                  placeholder="semaphore, twilio, resend"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="automation-key">Automation key</Label>
                <Input
                  id="automation-key"
                  value={draftFilters.automationKey ?? ""}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      automationKey: event.target.value,
                    }))
                  }
                  placeholder="appointment_reminder_24h"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="organization-id">Organization</Label>
                <Input
                  id="organization-id"
                  value={draftFilters.organizationId ?? ""}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      organizationId: event.target.value,
                    }))
                  }
                  placeholder="Organization ID"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button type="button" onClick={applyFilters}>
                Apply filters
              </Button>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <ChartCard title="Message volume over time">
              {chartData.length > 0 ? (
                <ChartContainer config={VOLUME_CHART_CONFIG} className="h-[260px] w-full">
                  <LineChart data={chartData} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="smsSent" stroke="var(--color-smsSent)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="emailDelivered" stroke="var(--color-emailDelivered)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ChartContainer>
              ) : (
                <ChartEmpty />
              )}
            </ChartCard>

            <ChartCard title="Failure trend over time">
              {chartData.length > 0 ? (
                <ChartContainer config={FAILURE_CHART_CONFIG} className="h-[260px] w-full">
                  <LineChart data={chartData} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="smsFailed" stroke="var(--color-smsFailed)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="emailFailed" stroke="var(--color-emailFailed)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="otpFailures" stroke="var(--color-otpFailures)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ChartContainer>
              ) : (
                <ChartEmpty />
              )}
            </ChartCard>
          </section>

          {messages.length === 0 ? (
            <EmptyState
              what="No communications found"
              why="No messages match the selected filters. Widen the range or clear a filter to review more delivery history."
              nextAction={
                <Button type="button" variant="outline" onClick={() => void refresh()}>
                  Refresh
                </Button>
              }
            />
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="grid gap-3">
                {messages.map((message) => (
                  <article key={message.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{message.channel.toUpperCase()}</Badge>
                          <Badge variant={message.deliveryStatus === "failed" ? "destructive" : "secondary"}>
                            {formatStatus(message.deliveryStatus ?? message.status)}
                          </Badge>
                        </div>
                        <h2 className="mt-3 text-base font-bold text-slate-950">
                          {message.businessName}
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                          {formatDate(message.createdAt)} · {message.purpose} · {message.provider ?? "No provider"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void openDetail(message.id)}
                        aria-label={`View message ${message.id}`}
                      >
                        View
                      </Button>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-4">
                      <Field label="Recipient" value={message.recipientMasked ?? "Not available"} />
                      <Field label="Automation" value={message.automationKey} />
                      <Field label="Units" value={String(message.unitsConsumed)} />
                      <Field label="Failure reason" value={message.failureReason ?? "None"} />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      ) : null}

      <PlatformAdminMessageDetailDrawer
        detail={detail}
        error={detailError}
        loading={detailLoading}
        onOpenChange={(open) => {
          if (!open) setSelectedMessageId(null);
        }}
        onRetry={() => selectedMessageId && void openDetail(selectedMessageId)}
        open={selectedMessageId !== null}
      />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">
        {new Intl.NumberFormat("en-PH").format(value)}
      </p>
    </article>
  );
}

function ChartCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-bold text-slate-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ChartEmpty() {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-600">
      No chart data in this range.
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-semibold text-slate-600">{label}</p>
      <p className="mt-1 break-words text-slate-950">{value}</p>
    </div>
  );
}

function cleanFilters(filters: PlatformAdminCommunicationFilters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== ""),
  ) as PlatformAdminCommunicationFilters;
}

function formatStatus(value: string) {
  return value.replace(/_/g, " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatBucket(value: string, range: CommunicationsRange) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: range === "24h" ? "numeric" : undefined,
  }).format(date);
}
