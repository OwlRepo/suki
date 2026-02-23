"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { hasClerk } from "@/lib/clerk";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { ListSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PrimaryPageAction } from "@/components/ui/primary-page-action";
import { useWorkspace } from "@/contexts/workspace-context";

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
    if (!selectedBiz) return;
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

  if (!workspace?.loading && !businesses.length) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Loyalty"
          plainLanguageDescription="Regular customers appear here when they meet the visit threshold."
          whatThisPageIsFor="See who qualifies for rewards. No configuration needed."
          whatToDoNext="Create a business in Setup first, then add customers to see loyalty status here."
        />
      </div>
    );
  }

  const handleThresholdChange = (value: number) => {
    setThreshold(value);
  };

  return (
    <div className="space-y-8 w-full">
        <PageHeader
          title="Loyalty"
          plainLanguageDescription="Regular customers appear here automatically when they meet the visit threshold."
          whatThisPageIsFor="See who qualifies for rewards. No configuration needed."
          whatToDoNext="Adjust the visit threshold below to change who counts as a regular."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={String(threshold)}
                onValueChange={(v) => handleThresholdChange(parseInt(v, 10))}
              >
                <SelectTrigger className="min-h-[44px]" aria-label="Visit threshold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[3, 5, 10, 15, 20].map((t) => (
                    <SelectItem key={t} value={String(t)}>
                      {t}+ visits
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="text"
                placeholder="Filter by label (e.g. VIP)"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="min-h-[44px] w-40"
                aria-label="Filter by label"
              />
            </div>
          }
        />

        <PrimaryPageAction
          hintText={`After ${threshold} visits, customers become regulars. Example: Every 6th visit gets ₱100 off.`}
        />

      <PageSection>
        {!syncReady || workspace?.loading || (!!selectedBiz && loyaltyLoading) ? (
          <ListSkeleton rowCount={5} className="mt-0" />
        ) : (
          <>
        <ul className="divide-y divide-border">
          {customers.map((c) => (
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
                  <Badge variant="outline" className="ml-2 bg-primary/10 border-primary/20">
                    Qualified
                  </Badge>
                )}
              </div>
            </li>
          ))}
        </ul>
        {customers.length === 0 && (
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
