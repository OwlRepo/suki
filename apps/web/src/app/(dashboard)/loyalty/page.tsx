"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { hasClerk } from "@/lib/clerk";

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
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<string>("");
  const [threshold, setThreshold] = useState(5);
  const [customers, setCustomers] = useState<LoyaltyCustomer[]>([]);
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
      const token = await getToken();
      if (!token) return;
      const res = await apiRequest<{ customers: LoyaltyCustomer[]; threshold: number }>(
        `/loyalty/status?businessId=${selectedBiz}&threshold=${threshold}`,
        { token },
      );
      setCustomers(res.customers);
    })();
  }, [selectedBiz, threshold, getToken]);

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (!businesses.length) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Loyalty</h1>
        <p className="mt-2 text-muted-foreground">Create a business in Setup first.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Loyalty</h1>
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
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Visit threshold:</label>
          <select
            value={threshold}
            onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {[3, 5, 10, 15, 20].map((t) => (
              <option key={t} value={t}>
                {t}+ visits
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        Customers with {threshold}+ visits qualify as loyal.
      </p>

      <div className="mt-6">
        <ul className="divide-y divide-border">
          {customers.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-3 first:pt-0">
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
        {customers.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">
            No customers meet the threshold yet.
          </p>
        )}
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
