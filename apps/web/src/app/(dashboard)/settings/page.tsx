"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@suki/ui";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { hasClerk } from "@/lib/clerk";

interface Organization {
  id: string;
  name: string;
}

interface Business {
  id: string;
  name: string;
  businessType: string;
}

interface BillingStatus {
  status: string;
  planType: string;
  subscription: { planType?: string; status?: string; currentPeriodEnd?: string } | null;
}

function UpgradeButton({
  planType,
  currentPlan,
  getToken,
}: {
  planType: string;
  currentPlan: string;
  getToken: () => Promise<string | null>;
}) {
  const [loading, setLoading] = useState(false);
  const prices: Record<string, number> = { growth: 499, ai_pro: 999 };
  const price = prices[planType] ?? 0;
  const isCurrent = currentPlan === planType;
  const isUpgrade =
    (planType === "ai_pro" && currentPlan !== "ai_pro") ||
    (planType === "growth" && currentPlan === "starter");

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiRequest<{ checkoutUrl: string }>("/billing/checkout", {
        method: "POST",
        token,
        body: JSON.stringify({ planType }),
      });
      if (res.checkoutUrl) window.location.href = res.checkoutUrl;
    } catch (err) {
      alert(err instanceof Error ? err.message : "Checkout unavailable. Is PayMongo configured?");
    } finally {
      setLoading(false);
    }
  };

  if (isCurrent) return null;
  return (
    <Button
      size="sm"
      variant={isUpgrade ? "default" : "outline"}
      onClick={handleUpgrade}
      disabled={loading}
    >
      {loading ? "..." : `${planType} – ₱${price}/mo`}
    </Button>
  );
}

function SettingsPageContent() {
  const { getToken } = useAuth();
  const { data: syncData } = useAuthSync();
  const [org, setOrg] = useState<Organization | null>(null);
  const [orgName, setOrgName] = useState("");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingOrg, setSavingOrg] = useState(false);
  const [editingBiz, setEditingBiz] = useState<string | null>(null);
  const [editBizName, setEditBizName] = useState("");

  useEffect(() => {
    if (!syncData) return;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const [orgRes, bizRes, billRes] = await Promise.all([
          apiRequest<{ organization: Organization }>("/organizations/me", { token }),
          apiRequest<{ businesses: Business[] }>("/businesses", { token }),
          apiRequest<BillingStatus>("/billing/status", { token }),
        ]);
        setOrg(orgRes.organization ?? null);
        setOrgName(orgRes.organization?.name ?? "");
        setBusinesses(bizRes.businesses);
        setBilling(billRes);
      } finally {
        setLoading(false);
      }
    })();
  }, [syncData, getToken]);

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) return;
    setSavingOrg(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiRequest<{ organization: Organization }>("/organizations/me", {
        method: "PATCH",
        token,
        body: JSON.stringify({ name: orgName.trim() }),
      });
      setOrg(res.organization);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingOrg(false);
    }
  };

  const handleSaveBiz = async (id: string) => {
    if (!editBizName.trim()) return;
    try {
      const token = await getToken();
      if (!token) return;
      await apiRequest(`/businesses/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ name: editBizName.trim() }),
      });
      setBusinesses((prev) =>
        prev.map((b) => (b.id === id ? { ...b, name: editBizName.trim() } : b)),
      );
      setEditingBiz(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    }
  };

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
      <p className="mt-2 text-muted-foreground">
        Manage your organization, businesses, and billing.
      </p>

      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-medium">Organization</h2>
        <form onSubmit={handleSaveOrg} className="flex gap-2">
          <Input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Organization name"
            className="max-w-md"
          />
          <Button type="submit" disabled={savingOrg}>
            {savingOrg ? "Saving..." : "Save"}
          </Button>
        </form>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-medium">Businesses</h2>
        <ul className="divide-y divide-border">
          {businesses.map((b) => (
            <li key={b.id} className="flex items-center justify-between py-3 first:pt-0">
              {editingBiz === b.id ? (
                <div className="flex gap-2">
                  <Input
                    value={editBizName}
                    onChange={(e) => setEditBizName(e.target.value)}
                    placeholder="Business name"
                    className="w-64"
                  />
                  <Button size="sm" onClick={() => handleSaveBiz(b.id)}>
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingBiz(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <div>
                    <span className="font-medium">{b.name}</span>
                    <span className="ml-2 text-sm text-muted-foreground capitalize">
                      {b.businessType}
                    </span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { setEditingBiz(b.id); setEditBizName(b.name); }}>
                    Edit
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
        {businesses.length === 0 && (
          <p className="text-muted-foreground">No businesses yet. Create one in Setup.</p>
        )}
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-medium">Billing</h2>
        <div className="rounded-lg border border-border bg-card p-4 max-w-md">
          <p className="text-sm text-muted-foreground">Plan</p>
          <p className="mt-1 font-medium capitalize">{billing?.planType ?? "starter"}</p>
          <p className="text-sm text-muted-foreground">Status: {billing?.status ?? "none"}</p>
          {billing?.subscription?.currentPeriodEnd && (
            <p className="mt-1 text-sm text-muted-foreground">
              Current period ends: {new Date(billing.subscription.currentPeriodEnd).toLocaleDateString()}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {(["growth", "ai_pro"] as const).map((plan) => (
              <UpgradeButton
                key={plan}
                planType={plan}
                currentPlan={billing?.planType ?? "starter"}
                getToken={getToken}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function SettingsPage() {
  if (!hasClerk) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Clerk authentication is not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to manage settings.
        </p>
      </div>
    );
  }
  return <SettingsPageContent />;
}
