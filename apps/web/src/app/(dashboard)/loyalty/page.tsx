"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { hasClerk } from "@/lib/clerk";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { ListSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PrimaryPageAction } from "@/components/ui/primary-page-action";
import {
  PracticeDayBanner,
  OnboardingGuidance,
  TooltipBadge,
} from "@/components/onboarding";
import { useOnboarding } from "@/contexts/onboarding-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { ONBOARDING_STEPS, SAMPLE_LOYALTY, SAMPLE_CUSTOMERS, PRACTICE_SAMPLE_LABEL } from "@/lib/onboarding";
import { recordOnboardingEvent } from "@/lib/onboarding-metrics";

interface Business {
  id: string;
  name: string;
}

interface LoyaltyCustomer {
  id: string;
  name: string;
  visitCount: number;
  lastVisitAt?: string | null;
  eligible: boolean;
}

function LoyaltyPageContent() {
  const { getToken } = useAuth();
  const { data: syncData } = useAuthSync();
  const onboarding = useOnboarding();
  const workspace = useWorkspace();
  const selectedBiz = workspace?.activeBusinessId ?? "";
  const businesses = workspace?.businesses ?? [];
  const [threshold, setThreshold] = useState(5);
  const [tagFilter, setTagFilter] = useState("");
  const [customers, setCustomers] = useState<LoyaltyCustomer[]>([]);
  const [syncReady, setSyncReady] = useState(false);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);

  useEffect(() => {
    if (!syncData) return;
    setSyncReady(true);
  }, [syncData]);

  useEffect(() => {
    if (!selectedBiz || (onboarding?.practiceMode && !onboarding.onboardingCompletedAt)) return;
    setLoyaltyLoading(true);
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        let url = `/loyalty/status?businessId=${selectedBiz}&threshold=${threshold}`;
        if (tagFilter.trim()) url += `&tag=${encodeURIComponent(tagFilter.trim())}`;
        const res = await apiRequest<{ customers: LoyaltyCustomer[]; threshold: number }>(
          url,
          { token },
        );
        setCustomers(res.customers);
      } finally {
        setLoyaltyLoading(false);
      }
    })();
  }, [selectedBiz, threshold, tagFilter, getToken]);

  const showPracticeData = onboarding?.practiceMode && !onboarding.onboardingCompletedAt;
  const displayCustomers = showPracticeData
    ? SAMPLE_CUSTOMERS.filter((c) => c.visitCount >= SAMPLE_LOYALTY.threshold).map((c) => ({
        id: c.id,
        name: c.name,
        visitCount: c.visitCount,
        lastVisitAt: c.lastVisitAt ?? null,
        eligible: c.visitCount >= SAMPLE_LOYALTY.threshold,
      }))
    : customers;
  const displayThreshold = showPracticeData ? SAMPLE_LOYALTY.threshold : threshold;
  const displayBusinesses = showPracticeData && !businesses.length
    ? [{ id: "practice", name: "Practice business" }]
    : businesses;

  if (!workspace?.loading && !businesses.length && !showPracticeData) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Loyalty</h1>
        <p className="mt-2 text-muted-foreground">Create a business in Setup first.</p>
      </div>
    );
  }

  const handleThresholdChange = (value: number) => {
    setThreshold(value);
    if (onboarding?.currentStep === ONBOARDING_STEPS.loyalty) {
      onboarding.advanceStep();
      recordOnboardingEvent("loyalty_enabled", syncData?.organization?.id ?? null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="empty:hidden">
        <PracticeDayBanner />
        <OnboardingGuidance
          step={ONBOARDING_STEPS.loyalty}
          screen="loyalty"
          onComplete={() => {}}
        />
      </div>
      <div className="space-y-8">
        <PageHeader
          title={<TooltipBadge screen="loyalty">Loyalty</TooltipBadge>}
          plainLanguageDescription="Regular customers appear here automatically when they meet the visit threshold."
          whatThisPageIsFor="See who qualifies for rewards. No configuration needed."
          whatToDoNext="Adjust the visit threshold below to change who counts as a regular."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={showPracticeData ? displayThreshold : threshold}
                onChange={(e) => handleThresholdChange(parseInt(e.target.value, 10))}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[44px]"
                aria-label="Visit threshold"
              >
                {[3, 5, 10, 15, 20].map((t) => (
                  <option key={t} value={t}>
                    {t}+ visits
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Filter by label (e.g. VIP)"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-base min-h-[44px] w-40"
                aria-label="Filter by label"
              />
            </div>
          }
        />

        <PrimaryPageAction
          hintText={`After ${displayThreshold} visits, customers become regulars. Example: Every 6th visit gets ₱100 off.`}
        />
        {showPracticeData && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {PRACTICE_SAMPLE_LABEL}: {SAMPLE_LOYALTY.reward}
          </p>
        )}

      <PageSection>
        {!showPracticeData && (!syncReady || workspace?.loading || (!!selectedBiz && loyaltyLoading)) ? (
          <ListSkeleton rowCount={5} className="mt-0" />
        ) : (
          <>
        <ul className="divide-y divide-border">
          {displayCustomers.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-5 first:pt-0">
              <div>
                <span className="font-medium">{c.name}</span>
                <span className="ml-2 text-sm text-muted-foreground">
                  {c.visitCount} visits
                </span>
                {c.lastVisitAt && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    Last: {new Date(c.lastVisitAt).toLocaleDateString()}
                  </span>
                )}
                {c.eligible && (
                  <span className="ml-2 rounded bg-primary/10 px-2 py-0.5 text-xs">
                    Qualified
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
        {displayCustomers.length === 0 && (
          <EmptyState
            what="No regular customers yet"
            why="Regular customers will appear here automatically once they reach the visit threshold. Keep recording visits."
            nextAction={
              <Link href="/customers">
                <Button size="lg">Go to Customers and record visits</Button>
              </Link>
            }
          />
        )}
          </>
        )}
      </PageSection>
      </div>
    </div>
  );
}

export default function LoyaltyPage() {
  if (!hasClerk) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Loyalty</h1>
        <p className="mt-2 text-muted-foreground">
          Clerk authentication is not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to view loyalty status.
        </p>
      </div>
    );
  }
  return <LoyaltyPageContent />;
}
