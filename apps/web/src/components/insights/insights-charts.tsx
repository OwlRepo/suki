"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface Metrics {
  newCustomers: number;
  repeatCustomers: number;
  repeatVisits: number;
}

const BAR_CHART_CONFIG = {
  firstTime: {
    label: "First-time customers",
    color: "var(--color-chart-1)",
  },
  seenThisMonth: {
    label: "Customers seen this month",
    color: "var(--color-chart-2)",
  },
  returning: {
    label: "Returning (2+ visits)",
    color: "var(--color-chart-3)",
  },
} satisfies ChartConfig;

const PIE_CHART_CONFIG = {
  firstTime: {
    label: "First-time",
    color: "var(--color-chart-1)",
  },
  returning: {
    label: "Returning (2+ visits)",
    color: "var(--color-chart-2)",
  },
} satisfies ChartConfig;

const BAR_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
] as const;

export function InsightsBarChart({ metrics }: { metrics: Metrics }) {
  const data = [
    { name: "First-time customers", value: metrics.newCustomers },
    { name: "Customers seen this month", value: metrics.repeatVisits },
    { name: "Returning (2+ visits)", value: metrics.repeatCustomers },
  ];

  const hasData = data.some((d) => d.value > 0);

  if (!hasData) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-muted-foreground text-sm">
        No data to show yet. Record visits to see charts.
      </div>
    );
  }

  return (
    <ChartContainer config={BAR_CHART_CONFIG} className="h-[200px] w-full">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 8, right: 8 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 13 }}
          width={160}
          tickLine={false}
          axisLine={false}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => [value, ""]}
              labelFormatter={(label) => label}
            />
          }
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((_, index) => (
            <Cell key={index} fill={BAR_COLORS[index]} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export function InsightsPieChart({ metrics }: { metrics: Metrics }) {
  const total = metrics.newCustomers + metrics.repeatCustomers;
  const hasData = total > 0;

  if (!hasData) {
    return null;
  }

  const data = [
    { name: "firstTime", value: metrics.newCustomers, fill: "var(--color-chart-1)" },
    { name: "returning", value: metrics.repeatCustomers, fill: "var(--color-chart-2)" },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return null;
  }

  const tooltipFormatter = (value: unknown) => {
    const num = Number(value);
    const pct = total > 0 ? Math.round((num / total) * 100) : 0;
    return num + " (" + pct + "%)";
  };

  return (
    <ChartContainer config={PIE_CHART_CONFIG} className="mx-auto h-[180px] w-full max-w-[220px]">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent formatter={tooltipFormatter} />} />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={50}
          strokeWidth={2}
          paddingAngle={2}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="name" hideIcon />} />
      </PieChart>
    </ChartContainer>
  );
}
