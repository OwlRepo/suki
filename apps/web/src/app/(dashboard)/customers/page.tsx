"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@suki/ui";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { hasClerk } from "@/lib/clerk";
import { IntakeQRBlock } from "@/components/intake-qr-block";
import {
  PracticeDayBanner,
  OnboardingGuidance,
  TooltipBadge,
} from "@/components/onboarding";
import { useOnboarding } from "@/contexts/onboarding-context";
import { ONBOARDING_STEPS, SAMPLE_CUSTOMERS, PRACTICE_SAMPLE_LABEL } from "@/lib/onboarding";
import { recordOnboardingEvent } from "@/lib/onboarding-metrics";

interface Business {
  id: string;
  name: string;
  businessType: string;
}

interface Customer {
  id: string;
  name: string;
  mobile?: string;
  tags?: string | null;
  visitCount: number;
  lastVisitAt?: string;
  createdAt: string;
}

function CustomersPageContent() {
  const { getToken } = useAuth();
  const { data: syncData } = useAuthSync();
  const onboarding = useOnboarding();
  const orgId = syncData?.organization?.id ?? null;
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<string>("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMobile, setNewMobile] = useState("");
  const [newTags, setNewTags] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!syncData) return;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await apiRequest<{ businesses: Business[] }>("/businesses", { token });
        setBusinesses(res.businesses);
        if (res.businesses.length) setSelectedBiz(res.businesses[0].id);
      } finally {
        setLoading(false);
      }
    })();
  }, [syncData, getToken]);

  useEffect(() => {
    if (!selectedBiz) return;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const params = new URLSearchParams({ businessId: selectedBiz });
        if (search) params.set("search", search);
        if (tagFilter.trim()) params.set("tag", tagFilter.trim());
        const res = await apiRequest<{ customers: Customer[]; total: number }>(
          `/customers?${params}`,
          { token },
        );
        setCustomers(res.customers);
        setTotal(res.total);
      } catch {
        setCustomers([]);
        setTotal(0);
      }
    })();
  }, [selectedBiz, search, tagFilter, getToken]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !selectedBiz) return;
    try {
      const token = await getToken();
      if (!token) return;
      await apiRequest("/customers", {
        method: "POST",
        token,
        body: JSON.stringify({
          businessId: selectedBiz,
          name: newName.trim(),
          mobile: newMobile.trim() || undefined,
          tags: newTags.trim() || undefined,
        }),
      });
      onboarding?.advanceStep();
      if (total === 0) recordOnboardingEvent("first_customer_added", orgId);
      setNewName("");
      setNewMobile("");
      setNewTags("");
      setShowAdd(false);
      const params = new URLSearchParams({ businessId: selectedBiz });
      const res = await apiRequest<{ customers: Customer[]; total: number }>(
        `/customers?${params}`,
        { token },
      );
      setCustomers(res.customers);
      setTotal(res.total);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove customer "${name}"? This cannot be undone.`)) return;
    try {
      const token = await getToken();
      if (!token) return;
      await apiRequest(`/customers/${id}`, { method: "DELETE", token });
      if (selectedBiz) {
        const params = new URLSearchParams({ businessId: selectedBiz });
        if (search) params.set("search", search);
        if (tagFilter.trim()) params.set("tag", tagFilter.trim());
        const res = await apiRequest<{ customers: Customer[]; total: number }>(
          `/customers?${params}`,
          { token },
        );
        setCustomers(res.customers);
        setTotal(res.total);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove customer");
    }
  };

  const handleStampVisit = async (id: string) => {
    try {
      const token = await getToken();
      if (!token) return;
      await apiRequest(`/customers/${id}/visit`, { method: "POST", token });
      if (onboarding?.currentStep === ONBOARDING_STEPS.recordVisit) {
        onboarding.advanceStep();
      }
      recordOnboardingEvent("visit_recorded", orgId);
      if (selectedBiz) {
        const params = new URLSearchParams({ businessId: selectedBiz });
        const res = await apiRequest<{ customers: Customer[]; total: number }>(
          `/customers?${params}`,
          { token },
        );
        setCustomers(res.customers);
      }
    } catch {
      alert("Failed to record visit");
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }
  if (!businesses.length) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Customers</h1>
        <p className="mt-2 text-muted-foreground">
          Create a business in Setup first, then add customers here.
        </p>
      </div>
    );
  }

  const showPracticeData = onboarding?.practiceMode && !onboarding.onboardingCompletedAt;
  const displayCustomers = showPracticeData ? SAMPLE_CUSTOMERS : customers;
  const displayTotal = showPracticeData ? SAMPLE_CUSTOMERS.length : total;

  return (
    <div className="space-y-8">
      <div>
      <PracticeDayBanner />
      <OnboardingGuidance
        step={ONBOARDING_STEPS.customersPage}
        screen="customers"
        onComplete={() => {}}
      />
      {onboarding?.currentStep === ONBOARDING_STEPS.recordVisit && customers.length > 0 && (
        <OnboardingGuidance
          step={ONBOARDING_STEPS.recordVisit}
          screen="customers"
          onComplete={() => {}}
        />
      )}
      </div>
      <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground">
          <TooltipBadge screen="customers">Customers</TooltipBadge>
        </h1>
        <div className="flex gap-2">
          <select
            value={selectedBiz}
            onChange={(e) => setSelectedBiz(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <Input
            placeholder="Search by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-40"
          />
          <Input
            placeholder="Filter by tag (e.g. vip)"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="w-40"
          />
          <Button onClick={() => setShowAdd(true)}>Add customer</Button>
        </div>
      </div>

      {selectedBiz && (
        <IntakeQRBlock
          businessId={selectedBiz}
          businessName={businesses.find((b) => b.id === selectedBiz)?.name ?? ""}
          className="mt-8"
        />
      )}

      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="mt-8 flex flex-wrap gap-2 rounded-md border border-border bg-card p-4"
        >
          <p className="w-full basis-full text-sm text-muted-foreground">
            You can edit this later.
          </p>
          <Input
            placeholder="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            className="flex-1"
          />
          <Input
            placeholder="Mobile"
            value={newMobile}
            onChange={(e) => setNewMobile(e.target.value)}
            className="w-40"
          />
          <Input
            placeholder="Tags (e.g. vip,frequent)"
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
            className="w-40"
          />
          <Button type="submit">
            {onboarding?.practiceMode ? "Practice save" : "Save"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
            Cancel
          </Button>
        </form>
      )}

      <div className="mt-8">
        <p className="text-sm text-muted-foreground">
          {displayTotal} customer{displayTotal !== 1 ? "s" : ""}
        </p>
        <ul className="mt-4 divide-y divide-border">
          {displayCustomers.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between py-5 first:pt-0"
            >
              <div>
                <span className="font-medium">{c.name}</span>
                {"isPracticeSample" in c && (c as { isPracticeSample?: boolean }).isPracticeSample && (
                  <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                    {PRACTICE_SAMPLE_LABEL}
                  </span>
                )}
                {c.mobile && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    {c.mobile}
                  </span>
                )}
                <span className="ml-2 text-sm text-muted-foreground">
                  Visits: {"visitCount" in c ? c.visitCount : 0}
                  {c.lastVisitAt &&
                    ` · Last: ${new Date(c.lastVisitAt).toLocaleDateString()}`}
                </span>
                {c.tags && (
                  <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs">
                    {c.tags}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {"isPracticeSample" in c && (c as { isPracticeSample?: boolean }).isPracticeSample ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onboarding?.advanceStep();
                    }}
                  >
                    Practice: Record visit
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStampVisit(c.id)}
                  >
                    Record visit
                  </Button>
                )}
                {!("isPracticeSample" in c && (c as { isPracticeSample?: boolean }).isPracticeSample) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(c.id, c.name)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {displayCustomers.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">No customers yet. You can edit details anytime.</p>
        )}
      </div>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  if (!hasClerk) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Customers</h1>
        <p className="mt-2 text-muted-foreground">
          Clerk authentication is not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to manage customers.
        </p>
      </div>
    );
  }
  return <CustomersPageContent />;
}
