"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@suki/ui";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { hasClerk } from "@/lib/clerk";
import { CustomerFormModal } from "@/components/customers/customer-form-modal";
import { CustomerItemActions } from "@/components/customers/customer-item-actions";
import { IntakeQRBlock } from "@/components/intake-qr-block";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { StatusBanner } from "@/components/ui/status-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { PrimaryPageAction } from "@/components/ui/primary-page-action";
import {
  PracticeDayBanner,
  OnboardingGuidance,
  TooltipBadge,
} from "@/components/onboarding";
import { AiQuotaBanner } from "@/components/ai-quota-banner";
import { useOnboarding } from "@/contexts/onboarding-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { ONBOARDING_STEPS, SAMPLE_CUSTOMERS, PRACTICE_SAMPLE_LABEL } from "@/lib/onboarding";
import { recordOnboardingEvent } from "@/lib/onboarding-metrics";
import { fromError } from "@/lib/ui-feedback";

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
  const workspace = useWorkspace();
  const orgId = syncData?.organization?.id ?? null;
  const selectedBiz = workspace?.activeBusinessId ?? "";
  const businesses = workspace?.businesses ?? [];
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!syncData) return;
    setLoading(false);
  }, [syncData]);

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

  const handleAdd = async (data: { name: string; mobile?: string; tags?: string }) => {
    if (!selectedBiz) return;
    setAddLoading(true);
    setFeedback(null);
    try {
      const token = await getToken();
      if (!token) return;
      await apiRequest("/customers", {
        method: "POST",
        token,
        body: JSON.stringify({
          businessId: selectedBiz,
          name: data.name.trim(),
          mobile: data.mobile?.trim() || undefined,
          tags: data.tags?.trim() || undefined,
        }),
      });
      onboarding?.advanceStep();
      if (total === 0) recordOnboardingEvent("first_customer_added", orgId);
      setShowAdd(false);
      setFeedback({ type: "success", message: "Customer added. You can edit details anytime." });
      setTimeout(() => setFeedback(null), 4000);
      const params = new URLSearchParams({ businessId: selectedBiz });
      if (search) params.set("search", search);
      if (tagFilter.trim()) params.set("tag", tagFilter.trim());
      const res = await apiRequest<{ customers: Customer[]; total: number }>(
        `/customers?${params}`,
        { token },
      );
      setCustomers(res.customers);
      setTotal(res.total);
    } catch (err) {
      setFeedback({ type: "error", message: fromError(err, "Failed to save customer. Please try again.") });
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
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
      setFeedback({ type: "success", message: "Customer removed." });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({ type: "error", message: fromError(err, "Failed to remove customer. Please try again.") });
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
        if (search) params.set("search", search);
        if (tagFilter.trim()) params.set("tag", tagFilter.trim());
        const res = await apiRequest<{ customers: Customer[]; total: number }>(
          `/customers?${params}`,
          { token },
        );
        setCustomers(res.customers);
      }
      setFeedback({ type: "success", message: "Visit recorded." });
      setTimeout(() => setFeedback(null), 3000);
    } catch {
      setFeedback({ type: "error", message: "Failed to record visit" });
    }
  };

  if (loading || workspace?.loading) {
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
      <div className="space-y-8">
        <AiQuotaBanner />
        <PageHeader
          title={<TooltipBadge screen="customers">Customers</TooltipBadge>}
          plainLanguageDescription="This is your customer list. Add people here and track their visits."
          whatThisPageIsFor="Keep customer details and visit history in one place."
          whatToDoNext={displayTotal === 0 ? "Add your first customer." : "Record a visit for a recent customer."}
          actions={
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Search by name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-40"
                aria-label="Search by name"
              />
              <Input
                placeholder="Find customer by label (VIP, Regular)"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="w-48"
                aria-label="Filter by label"
              />
            </div>
          }
        />
        <PrimaryPageAction
          primaryAction={
            <Button onClick={() => setShowAdd(true)} size="lg">
              Add customer
            </Button>
          }
          hintText="Start with name and mobile. You can add optional labels later."
        />

        {feedback && (
          <StatusBanner
            variant={feedback.type}
            message={feedback.message}
            onDismiss={() => setFeedback(null)}
          />
        )}

      {selectedBiz && (
        <PageSection>
          <IntakeQRBlock
            businessId={selectedBiz}
            businessName={businesses.find((b) => b.id === selectedBiz)?.name ?? ""}
            heading="Let customers add themselves"
            helperText="Share this QR or link so customers can register without paperwork."
            showPrintButton
          />
        </PageSection>
      )}

        <CustomerFormModal
          open={showAdd}
          onClose={() => setShowAdd(false)}
          onSubmit={handleAdd}
          loading={addLoading}
          practiceMode={onboarding?.practiceMode ?? false}
        />

      <PageSection>
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
              <CustomerItemActions
                onRecordVisit={() => handleStampVisit(c.id)}
                onRemove={() => handleDelete(c.id)}
                isPracticeSample={"isPracticeSample" in c && (c as { isPracticeSample?: boolean }).isPracticeSample}
                onPracticeAdvance={onboarding?.advanceStep}
              />
            </li>
          ))}
        </ul>
        {displayCustomers.length === 0 && (
          <EmptyState
            what="No customers yet"
            why="Adding customers here helps you track visits, appointments, and repeat business."
            nextAction={
              <Button onClick={() => setShowAdd(true)} size="lg">
                Add your first customer
              </Button>
            }
          />
        )}
      </PageSection>
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
