"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@suki/ui";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { hasClerk } from "@/lib/clerk";

interface Business {
  id: string;
  name: string;
  businessType: string;
}

interface Customer {
  id: string;
  name: string;
  mobile?: string;
  visitCount: number;
  lastVisitAt?: string;
  createdAt: string;
}

function CustomersPageContent() {
  const { getToken } = useAuth();
  const { data: syncData } = useAuthSync();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<string>("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMobile, setNewMobile] = useState("");
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
  }, [selectedBiz, search, getToken]);

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
        }),
      });
      setNewName("");
      setNewMobile("");
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

  const handleStampVisit = async (id: string) => {
    try {
      const token = await getToken();
      if (!token) return;
      await apiRequest(`/customers/${id}/visit`, { method: "POST", token });
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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Customers</h1>
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
            className="w-48"
          />
          <Button onClick={() => setShowAdd(true)}>Add customer</Button>
        </div>
      </div>

      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="mt-4 flex gap-2 rounded-md border border-border bg-card p-4"
        >
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
          <Button type="submit">Save</Button>
          <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
            Cancel
          </Button>
        </form>
      )}

      <div className="mt-4">
        <p className="text-sm text-muted-foreground">
          {total} customer{total !== 1 ? "s" : ""}
        </p>
        <ul className="mt-2 divide-y divide-border">
          {customers.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between py-3 first:pt-0"
            >
              <div>
                <span className="font-medium">{c.name}</span>
                {c.mobile && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    {c.mobile}
                  </span>
                )}
                <span className="ml-2 text-sm text-muted-foreground">
                  Visits: {c.visitCount}
                  {c.lastVisitAt &&
                    ` · Last: ${new Date(c.lastVisitAt).toLocaleDateString()}`}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStampVisit(c.id)}
              >
                Record visit
              </Button>
            </li>
          ))}
        </ul>
        {customers.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">No customers yet.</p>
        )}
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
