"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BillingInterval, BillingPlan } from "./types";

function formatPhp(amount: number | null) {
  if (amount === null) return "Custom";
  return `PHP ${amount.toLocaleString("en-PH")}`;
}

export function PlanComparisonGrid({
  plans,
  interval,
  ctaHref,
  annualCheckoutEnabled = true,
}: {
  plans: BillingPlan[];
  interval: BillingInterval;
  ctaHref: string;
  annualCheckoutEnabled?: boolean;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {plans.map((plan) => {
        const price =
          interval === "annual" && plan.annualPricePhp !== null
            ? plan.annualPricePhp
            : plan.monthlyPricePhp;
        const annualDisabled =
          interval === "annual" &&
          plan.planType !== "free" &&
          !annualCheckoutEnabled;

        return (
          <Card key={plan.planType} className="flex h-full flex-col border border-border p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{plan.displayName}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {plan.planType === "free"
                    ? "Try Tyvera before you commit."
                    : `For ${plan.displayName.toLowerCase()} teams.`}
                </p>
              </div>
              {plan.mostPopular ? <Badge>Most Popular</Badge> : null}
            </div>
            <div className="mt-5">
              <p className="text-3xl font-semibold">{formatPhp(price)}</p>
              <p className="text-sm text-muted-foreground">
                {plan.planType === "free"
                  ? "No card required"
                  : interval === "annual"
                    ? "per year"
                    : "per month"}
              </p>
            </div>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-muted-foreground">
              <li>{plan.limits.verifiedOnlineBookingsPerMonth} verified online bookings</li>
              <li>{plan.limits.emailMessagesPerMonth.toLocaleString("en-PH")} emails / month</li>
              <li>
                {plan.limits.aiRequestsPerMonth > 0
                  ? `${plan.limits.aiRequestsPerMonth} AI requests / month`
                  : "No AI writing included"}
              </li>
              <li>{plan.limits.branches} branch{plan.limits.branches === 1 ? "" : "es"}</li>
              <li>{plan.limits.staffAccounts} staff account{plan.limits.staffAccounts === 1 ? "" : "s"}</li>
            </ul>
            {annualDisabled ? (
              <div className="mt-5 space-y-2">
                <Button type="button" className="w-full" disabled>
                  Choose plan
                </Button>
                <p className="text-xs text-muted-foreground">
                  Annual billing is visible now but not yet self-serve.
                </p>
              </div>
            ) : (
              <Button asChild className="mt-5 w-full">
                <Link href={ctaHref}>
                  {plan.planType === "free" ? "Get started" : "Choose plan"}
                </Link>
              </Button>
            )}
          </Card>
        );
      })}
    </div>
  );
}
