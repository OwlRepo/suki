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
import { CustomerMessageHistoryModal } from "@/components/customers/customer-message-history-modal";
import { IntakeQRBlock } from "@/components/intake-qr-block";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { ListSkeleton } from "@/components/ui/skeleton";
import { StatusBanner } from "@/components/ui/status-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { PrimaryPageAction } from "@/components/ui/primary-page-action";
import { AiQuotaBanner } from "@/components/ai-quota-banner";
import { useWorkspace } from "@/contexts/workspace-context";
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
  const [syncReady, setSyncReady] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [messageHistoryFor, setMessageHistoryFor] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!syncData) return;
    setSyncReady(true);
  }, [syncData]);

  useEffect(() => {
    if (!selectedBiz) return;
    setCustomersLoading(true);
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
      } finally {
        setCustomersLoading(false);
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

  if (!workspace?.loading && !businesses.length) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Customers</h1>
        <p className="mt-2 text-muted-foreground">
          Create a business in Setup first, then add customers here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
        <AiQuotaBanner />
        <PageHeader
          title="Customers"
          plainLanguageDescription="This is your customer list. Add people here and track their visits."
          whatThisPageIsFor="Keep customer details and visit history in one place."
          whatToDoNext={total === 0 ? "Add your first customer." : "Record a visit for a recent customer."}
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
        />

        <CustomerMessageHistoryModal
          open={!!messageHistoryFor}
          onClose={() => setMessageHistoryFor(null)}
          customerId={messageHistoryFor?.id ?? ""}
          customerName={messageHistoryFor?.name ?? ""}
        />

      <PageSection>
        <p className="text-sm text-muted-foreground">
          {total} customer{total !== 1 ? "s" : ""}
        </p>
        {!syncReady || workspace?.loading || (!!selectedBiz && customersLoading) ? (
          <ListSkeleton rowCount={6} className="mt-4" />
        ) : (
          <>
        <ul className="mt-4 divide-y divide-border">
          {customers.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between py-5 first:pt-0"
            >
              <div>
                <span className="font-medium">{c.name}</span>
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
                onViewMessages={() => setMessageHistoryFor({ id: c.id, name: c.name })}
              />
            </li>
          ))}
        </ul>
        {customers.length === 0 && (
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
          </>
        )}
      </PageSection>
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
