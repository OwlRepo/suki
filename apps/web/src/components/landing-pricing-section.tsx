"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFeatureFlags } from "@/hooks/use-feature-flags";

const PLANS = [
  {
    name: "Basic",
    price: "₱499",
    period: "/month",
    forWhom: "Organize customers first",
    features: [
      "Customer list, QR signup link, manual entry",
      "Last visit and visit count",
      "New customers this month",
    ],
    cta: "Start with Basic",
  },
  {
    name: "Grow",
    price: "₱999",
    period: "/month",
    forWhom: "Bring customers back",
    features: [
      "Everything in Basic",
      "Promos or Appointments module",
      "New vs repeat customers monthly",
      "Helpful message suggestions",
    ],
    cta: "Start with Grow",
  },
  {
    name: "Pro",
    price: "₱1,499",
    period: "/month",
    forWhom: "Run a busier business",
    features: [
      "Everything in Grow",
      "Two modules at once",
      "Month-to-month comparison",
    ],
    cta: "Start with Pro",
  },
] as const;

export function LandingPricingSection() {
  const flags = useFeatureFlags();
  if (!flags.self_serve_billing_enabled) return null;
  return (
    <section
      className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24"
      id="pricing"
    >
      <h2 className="text-center text-2xl font-semibold text-foreground sm:text-3xl">
        Plans that grow with your business
      </h2>
      <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">
        If one customer comes back because of this, it already paid for itself. A
        single missed appointment (e.g. ₱800+) is revenue you can get back.
        Pricing in PHP—local currency support coming for more regions.
      </p>
      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <Card
            key={plan.name}
            className="flex flex-col rounded-xl p-6 shadow-sm"
          >
            <h3 className="text-lg font-semibold text-card-foreground">
              {plan.name}
            </h3>
            <p className="mt-2 text-muted-foreground">{plan.forWhom}</p>
            <p className="mt-4 text-2xl font-bold text-foreground">
              {plan.price}
              <span className="text-base font-normal text-muted-foreground">
                {plan.period}
              </span>
            </p>
            <ul className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
              {plan.features.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
            <Button asChild size="lg" className="mt-6 min-h-[44px] w-full">
              <Link href="/sign-up">{plan.cta}</Link>
            </Button>
          </Card>
        ))}
      </div>
    </section>
  );
}
