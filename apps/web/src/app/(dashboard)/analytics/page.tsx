"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/contexts/workspace-context";
import { apiRequest } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBanner } from "@/components/ui/status-banner";
import { ListSkeleton } from "@/components/ui/skeleton";
import { usePlanCapabilities } from "@/hooks/use-plan-capabilities";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface MonitoringResponse {
  windowDays: number;
  startDate: string;
  ai: {
    daily: Array<{ day: string; tokens: number; requests: number }>;
    featureBreakdown: Array<{ key: string; tokens: number; requests: number }>;
    topUsers: Array<{ key: string; tokens: number; requests: number }>;
    topBusinesses: Array<{ key: string; tokens: number; requests: number }>;
  };
  automation: {
    daily: Array<{ day: string; total: number; sent: number; failed: number; skipped: number }>;
    statusBreakdown: Array<{ key: string; value: number }>;
    channelBreakdown: Array<{ key: string; value: number }>;
    keyBreakdown: Array<{ key: string; value: number }>;
  };
}

const PIE_COLORS = ["#0ea5e9", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"];

export default function AnalyticsPage() {
  const { getToken } = useAuth();
  const workspace = useWorkspace();
  const planCapabilities = usePlanCapabilities();
  const [data, setData] = useState<MonitoringResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!planCapabilities.canSeeAiAnalytics) {
      setLoading(false);
      setData(null);
      setError(null);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const token = await getToken();
        if (!token) return;
        const businessId = workspace?.activeBusinessId;
        const query = new URLSearchParams({ days: "30" });
        if (businessId) query.set("businessId", businessId);
        const res = await apiRequest<MonitoringResponse>(`/insights/monitoring?${query.toString()}`, {
          token,
        });
        setData(res);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load analytics.");
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken, planCapabilities.canSeeAiAnalytics, workspace?.activeBusinessId]);

  const automationStatusData = useMemo(
    () =>
      (data?.automation.statusBreakdown ?? []).map((item) => ({
        name: item.key,
        value: item.value,
      })),
    [data],
  );

  const automationChannelData = useMemo(
    () =>
      (data?.automation.channelBreakdown ?? []).map((item) => ({
        name: item.key,
        value: item.value,
      })),
    [data],
  );

  if (!planCapabilities.canSeeAiAnalytics) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Usage Analytics"
          plainLanguageDescription="Track AI and automated follow-up usage in one place."
          whatThisPageIsFor="Monitor activity trends, feature usage, and delivery outcomes."
        />
        <StatusBanner
          variant="info"
          message="AI analytics are available on Growth and Pro."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usage Analytics"
        plainLanguageDescription="Track AI and automated follow-up usage in one place."
        whatThisPageIsFor="Monitor activity trends, feature usage, and delivery outcomes."
      />

      {error ? <StatusBanner variant="error" message={error} /> : null}
      {loading ? (
        <ListSkeleton rowCount={6} />
      ) : !data ? (
        <StatusBanner variant="warning" message="No analytics data available yet." />
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              Last {data.windowDays} days starting {data.startDate}
            </p>
          </div>

          <section className="rounded-xl border bg-card p-4 space-y-3">
            <h2 className="text-lg font-semibold">AI Usage Trends</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.ai.daily}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="tokens" stroke="#0ea5e9" name="Tokens" />
                  <Line type="monotone" dataKey="requests" stroke="#16a34a" name="Requests" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4 space-y-3">
            <h2 className="text-lg font-semibold">AI Feature Breakdown</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.ai.featureBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="key" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="tokens" fill="#0ea5e9" name="Tokens" />
                  <Bar dataKey="requests" fill="#16a34a" name="Requests" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4 space-y-3">
            <h2 className="text-lg font-semibold">Automation Delivery Trends</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.automation.daily}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="sent" stroke="#16a34a" name="Sent" />
                  <Line type="monotone" dataKey="failed" stroke="#ef4444" name="Failed" />
                  <Line type="monotone" dataKey="skipped" stroke="#f59e0b" name="Skipped" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid gap-5 md:grid-cols-2">
            <section className="rounded-xl border bg-card p-4 space-y-3">
              <h2 className="text-lg font-semibold">Automation Status Mix</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={automationStatusData} dataKey="value" nameKey="name" outerRadius={90}>
                      {automationStatusData.map((_, index) => (
                        <Cell key={`status-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-xl border bg-card p-4 space-y-3">
              <h2 className="text-lg font-semibold">Automation Channel Mix</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={automationChannelData} dataKey="value" nameKey="name" outerRadius={90}>
                      {automationChannelData.map((_, index) => (
                        <Cell key={`channel-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
