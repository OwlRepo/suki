"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function CurrentPlanCard({
  planLabel,
  statusLabel,
  renewalLabel,
}: {
  planLabel: string;
  statusLabel: string;
  renewalLabel: string;
}) {
  return (
    <Card className="border border-border p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Current plan</p>
          <h2 className="mt-1 text-2xl font-semibold">{planLabel}</h2>
        </div>
        <Badge>{statusLabel}</Badge>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{renewalLabel}</p>
    </Card>
  );
}
