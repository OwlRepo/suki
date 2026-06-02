"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function UsageMeterCard({
  label,
  included,
  addon = 0,
  used,
  remaining,
  helper,
}: {
  label: string;
  included: number;
  addon?: number;
  used: number;
  remaining: number;
  helper: string;
}) {
  const total = included + addon;
  const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const warning = percent >= 80;
  const exhausted = remaining <= 0;

  return (
    <Card className="border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">{label}</h3>
          <p className="mt-1 text-2xl font-semibold">{remaining.toLocaleString("en-PH")} remaining</p>
        </div>
        {exhausted ? (
          <Badge variant="destructive">Exhausted</Badge>
        ) : warning ? (
          <Badge variant="secondary">80% used</Badge>
        ) : null}
      </div>
      <div className="mt-4 h-2 rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-primary"
          style={{ width: `${percent}%` }}
          aria-hidden
        />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {used.toLocaleString("en-PH")} used · {included.toLocaleString("en-PH")} included
        {addon > 0 ? ` · ${addon.toLocaleString("en-PH")} purchased` : ""}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </Card>
  );
}
