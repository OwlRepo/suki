"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, isApiConflictWithDuplicate } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { CustomerFormModal } from "@/components/customers/customer-form-modal";
import { CustomerItemActions } from "@/components/customers/customer-item-actions";
import { CustomerMessageHistoryModal } from "@/components/customers/customer-message-history-modal";
import { CustomerVisitAdjustmentModal } from "@/components/customers/customer-visit-adjustment-modal";
import { CustomerVisitHistoryModal } from "@/components/customers/customer-visit-history-modal";
import { IntakeQRBlock } from "@/components/intake-qr-block";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { ListSkeleton } from "@/components/ui/skeleton";
import { StatusBanner } from "@/components/ui/status-banner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  mobile?: string | null;
  email?: string | null;
  notes?: string | null;
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
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [syncReady, setSyncReady] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [messageHistoryFor, setMessageHistoryFor] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [adjustVisitFor, setAdjustVisitFor] = useState<{
    id: string;
    name: string;
    visitCount: number;
  } | null>(null);
  const [visitHistoryFor, setVisitHistoryFor] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [duplicateConfirm, setDuplicateConfirm] = useState<{
    open: boolean;
    matches: Array<{ id: string; name: string; reason: string }>;
    pendingData: {
      name: string;
      mobile?: string;
      email?: string;
      notes?: string;
      tags?: string;
    };
  }>({ open: false, matches: [], pendingData: { name: "" } });

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

  const doCreate = async (
    data: {
      name: string;
      mobile?: string;
      email?: string;
      notes?: string;
      tags?: string;
    },
    confirmDuplicate?: boolean,
  ) => {
    const token = await getToken();
    if (!token) return;
    await apiRequest("/customers", {
      method: "POST",
      token,
      body: JSON.stringify({
        businessId: selectedBiz,
        name: data.name.trim(),
        mobile: data.mobile?.trim() || undefined,
        email: data.email?.trim() || undefined,
        notes: data.notes?.trim() || undefined,
        tags: data.tags?.trim() || undefined,
        confirmDuplicate: confirmDuplicate ?? false,
      }),
    });
  };

  const handleAdd = async (data: {
    name: string;
    mobile?: string;
    email?: string;
    notes?: string;
    tags?: string;
  }) => {
    if (!selectedBiz) return;
    setAddLoading(true);
    setFeedback(null);
    setDuplicateConfirm({
      open: false,
      matches: [],
      pendingData: { name: "" },
    });
    try {
      const token = await getToken();
      if (!token) return;
      await doCreate(data);
      if (total === 0) recordOnboardingEvent("first_customer_added", orgId);
      setShowAdd(false);
      setDuplicateConfirm({
        open: false,
        matches: [],
        pendingData: { name: "" },
      });
      setFeedback({
        type: "success",
        message: "Customer added. You can edit details anytime.",
      });
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
      if (isApiConflictWithDuplicate(err)) {
        const e = err as Error & {
          responseBody: {
            matches: Array<{ id: string; name: string; reason: string }>;
          };
        };
        setDuplicateConfirm({
          open: true,
          matches: e.responseBody.matches,
          pendingData: data,
        });
        return;
      }
      setFeedback({
        type: "error",
        message: fromError(err, "Failed to save customer. Please try again."),
      });
    } finally {
      setAddLoading(false);
    }
  };

  const handleProceedWithDuplicate = async () => {
    if (!duplicateConfirm.open || !selectedBiz) return;
    const data = duplicateConfirm.pendingData;
    setAddLoading(true);
    setFeedback(null);
    try {
      const token = await getToken();
      if (!token) return;
      await doCreate(data, true);
      if (total === 0) recordOnboardingEvent("first_customer_added", orgId);
      setShowAdd(false);
      setDuplicateConfirm({
        open: false,
        matches: [],
        pendingData: { name: "" },
      });
      setFeedback({
        type: "success",
        message:
          "Customer added with duplicate tag. You can filter by 'duplicate' to find them.",
      });
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
      setFeedback({
        type: "error",
        message: fromError(err, "Failed to save customer. Please try again."),
      });
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
      setFeedback({
        type: "error",
        message: fromError(err, "Failed to remove customer. Please try again."),
      });
    }
  };

  const refreshCustomers = () => {
    if (!selectedBiz) return;
    (async () => {
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
    })();
  };

  const handleStampVisit = async (id: string) => {
    try {
      const token = await getToken();
      if (!token) return;
      await apiRequest(`/customers/${id}/visit`, { method: "POST", token });
      recordOnboardingEvent("visit_recorded", orgId);
      refreshCustomers();
      setFeedback({ type: "success", message: "Visit recorded." });
      setTimeout(() => setFeedback(null), 3000);
    } catch {
      setFeedback({ type: "error", message: "Failed to record visit" });
    }
  };

  if (!workspace?.loading && !businesses.length) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Customers"
          plainLanguageDescription="Your customer list lives here."
          whatThisPageIsFor="Keep customer details and visit history in one place."
          whatToDoNext="Create a business in Setup first, then add customers here."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full">
      <AiQuotaBanner />
      <PageHeader
        title="Customers"
        plainLanguageDescription="This is your customer list. Add people here and track their visits."
        whatThisPageIsFor="Keep customer details and visit history in one place."
        whatToDoNext={
          total === 0
            ? "Add your first customer."
            : "Record a visit for a recent customer."
        }
      />
      <PrimaryPageAction
        primaryAction={
          <Button onClick={() => setShowAdd(true)} size="lg">
            Add customer
          </Button>
        }
        hintText="Name is required. Add mobile and email for better retention and outreach."
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
            businessName={
              businesses.find((b) => b.id === selectedBiz)?.name ?? ""
            }
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
        businessId={selectedBiz}
        businessType={
          businesses.find((b) => b.id === selectedBiz)?.businessType ?? ""
        }
      />

      <Dialog
        open={duplicateConfirm.open}
        onOpenChange={(o) =>
          !o && setDuplicateConfirm((prev) => ({ ...prev, open: false }))
        }
      >
        <DialogContent className="sm:max-w-md" showCloseButton={true}>
          <DialogHeader>
            <DialogTitle>Possible duplicate found</DialogTitle>
            <DialogDescription>
              A customer with this name or mobile number may already exist.
              Adding anyway will tag them as a duplicate so you can find and
              review them later.
            </DialogDescription>
          </DialogHeader>
          {duplicateConfirm.matches.length > 0 && (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
              <p className="font-medium">Existing match:</p>
              <p className="mt-1 text-muted-foreground">
                {duplicateConfirm.matches[0].name} (matched by{" "}
                {duplicateConfirm.matches[0].reason})
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() =>
                setDuplicateConfirm((prev) => ({ ...prev, open: false }))
              }
              disabled={addLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleProceedWithDuplicate} disabled={addLoading}>
              {addLoading ? "Saving…" : "Proceed anyway"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CustomerMessageHistoryModal
        open={!!messageHistoryFor}
        onClose={() => setMessageHistoryFor(null)}
        customerId={messageHistoryFor?.id ?? ""}
        customerName={messageHistoryFor?.name ?? ""}
      />

      <CustomerVisitAdjustmentModal
        open={!!adjustVisitFor}
        onClose={() => setAdjustVisitFor(null)}
        customerId={adjustVisitFor?.id ?? ""}
        customerName={adjustVisitFor?.name ?? ""}
        currentVisitCount={adjustVisitFor?.visitCount ?? 0}
        onSuccess={() => {
          refreshCustomers();
          setFeedback({ type: "success", message: "Visit count updated." });
          setTimeout(() => setFeedback(null), 3000);
        }}
      />

      <CustomerVisitHistoryModal
        open={!!visitHistoryFor}
        onClose={() => setVisitHistoryFor(null)}
        customerId={visitHistoryFor?.id ?? ""}
        customerName={visitHistoryFor?.name ?? ""}
      />

      <PageSection>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search by name, mobile, email, notes, or label"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-[200px] max-w-xs"
            aria-label="Search customers"
          />
          <Input
            placeholder="Filter by label (VIP, duplicate)"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="w-48"
            aria-label="Filter by label"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {total} customer{total !== 1 ? "s" : ""}
        </p>
        {!syncReady ||
        workspace?.loading ||
        (!!selectedBiz && customersLoading) ? (
          <ListSkeleton rowCount={6} className="mt-4" />
        ) : (
          <>
            <ul className="mt-4 divide-y divide-border">
              {customers.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-4 py-6 first:pt-0 min-h-[52px]"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{c.name}</span>
                    {c.mobile && (
                      <span className="ml-2 text-sm text-muted-foreground">
                        {c.mobile}
                      </span>
                    )}
                    {c.email && (
                      <span className="ml-2 text-sm text-muted-foreground">
                        {c.email}
                      </span>
                    )}
                    <span className="ml-2 text-sm text-muted-foreground">
                      Visits: {"visitCount" in c ? c.visitCount : 0}
                      {c.lastVisitAt &&
                        ` · Last: ${new Date(c.lastVisitAt).toLocaleDateString()}`}
                    </span>
                    {c.tags && (
                      <Badge variant="secondary" className="ml-2">
                        {c.tags}
                      </Badge>
                    )}
                    {c.notes && (
                      <p
                        className="mt-1 truncate text-sm text-muted-foreground max-w-md whitespace-pre-wrap"
                        title={c.notes}
                      >
                        {c.notes}
                      </p>
                    )}
                  </div>
                  <CustomerItemActions
                    onRecordVisit={() => handleStampVisit(c.id)}
                    onRemove={() => handleDelete(c.id)}
                    onViewMessages={() =>
                      setMessageHistoryFor({ id: c.id, name: c.name })
                    }
                    onAdjustVisit={() =>
                      setAdjustVisitFor({
                        id: c.id,
                        name: c.name,
                        visitCount: "visitCount" in c ? c.visitCount : 0,
                      })
                    }
                    onViewVisitHistory={() =>
                      setVisitHistoryFor({ id: c.id, name: c.name })
                    }
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
  return <CustomersPageContent />;
}
