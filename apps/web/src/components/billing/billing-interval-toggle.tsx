"use client";

import { Button } from "@/components/ui/button";
import type { BillingInterval } from "./types";

export function BillingIntervalToggle({
  value,
  onChange,
}: {
  value: BillingInterval;
  onChange: (value: BillingInterval) => void;
}) {
  return (
    <div
      className="inline-flex rounded-md border border-border p-1"
      role="tablist"
      aria-label="Billing interval"
    >
      {(["monthly", "annual"] as const).map((interval) => (
        <Button
          key={interval}
          type="button"
          variant={value === interval ? "default" : "ghost"}
          size="sm"
          role="tab"
          aria-selected={value === interval}
          className="min-w-24"
          onClick={() => onChange(interval)}
        >
          {interval === "monthly" ? "Monthly" : "Annual"}
        </Button>
      ))}
    </div>
  );
}
