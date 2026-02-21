"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { useWorkspace } from "@/contexts/workspace-context";
import { hasClerk } from "@/lib/clerk";

interface Deal {
  id: string;
  title: string;
  stage: string;
  amount: number | null;
  customerId: string | null;
  createdAt: string;
}

interface DealStage {
  id: string;
  name: string;
  sortOrder: number;
}

function PipelinePageContent() {
  const { getToken } = useAuth();
  const workspace = useWorkspace();
  const businessId = workspace?.activeBusinessId ?? "";
  const activeBiz = workspace?.businesses.find((b) => b.id === businessId);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [dealStages, setDealStages] = useState<DealStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddStage, setShowAddStage] = useState(false);
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [newDealTitle, setNewDealTitle] = useState("");
  const [newDealAmount, setNewDealAmount] = useState("");
  const [newDealStage, setNewDealStage] = useState("");
  const [movingId, setMovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!businessId || activeBiz?.crmMode !== "full") {
      setLoading(false);
      return;
    }
    const token = await getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const [stagesRes, dealsRes] = await Promise.all([
        apiRequest<{ dealStages: DealStage[] }>(
          `/crm/deal-stages?businessId=${businessId}`,
          { token },
        ),
        apiRequest<{ deals: Deal[] }>(`/crm/deals?businessId=${businessId}`, {
          token },
        ),
      ]);
      let stages = stagesRes.dealStages ?? [];
      if (stages.length === 0) {
        await apiRequest(
          "/crm/deal-stages/ensure-defaults",
          { token, method: "POST", body: JSON.stringify({ businessId }) },
        );
        const retry = await apiRequest<{ dealStages: DealStage[] }>(
          `/crm/deal-stages?businessId=${businessId}`,
          { token },
        );
        stages = retry.dealStages ?? [];
      }
      setDealStages(stages);
      setDeals(dealsRes.deals ?? []);
      if (stages.length > 0 && !newDealStage) setNewDealStage(stages[0].name);
    } catch {
      setDeals([]);
      setDealStages([]);
    } finally {
      setLoading(false);
    }
  }, [businessId, activeBiz?.crmMode, getToken]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddStage = async () => {
    if (!newStageName.trim() || !getToken) return;
    const token = await getToken();
    if (!token) return;
    try {
      await apiRequest("/crm/deal-stages", {
        token,
        method: "POST",
        body: JSON.stringify({
          businessId,
          name: newStageName.trim(),
          sortOrder: dealStages.length,
        }),
      });
      setNewStageName("");
      setShowAddStage(false);
      load();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddDeal = async () => {
    if (!newDealTitle.trim() || !newDealStage || !getToken) return;
    const token = await getToken();
    if (!token) return;
    try {
      await apiRequest("/crm/deals", {
        token,
        method: "POST",
        body: JSON.stringify({
          businessId,
          title: newDealTitle.trim(),
          stage: newDealStage,
          amount: newDealAmount ? parseInt(newDealAmount, 10) : undefined,
        }),
      });
      setNewDealTitle("");
      setNewDealAmount("");
      setNewDealStage(dealStages[0]?.name ?? "");
      setShowAddDeal(false);
      load();
    } catch (e) {
      console.error(e);
    }
  };

  const handleMoveDeal = async (dealId: string, newStage: string) => {
    const token = await getToken();
    if (!token) return;
    setMovingId(dealId);
    try {
      await apiRequest(`/crm/deals/${dealId}/stage`, {
        token,
        method: "PATCH",
        body: JSON.stringify({ businessId, stage: newStage }),
      });
      load();
    } catch (e) {
      console.error(e);
    } finally {
      setMovingId(null);
    }
  };

  if (!businessId) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Pipeline</h1>
        <p className="mt-2 text-muted-foreground">
          Select a workspace to view deals.
        </p>
      </div>
    );
  }

  if (activeBiz?.crmMode !== "full") {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Pipeline</h1>
        <p className="mt-2 text-muted-foreground">
          Pipeline is available in CRM Full mode. Switch your business to Full in
          Settings.
        </p>
      </div>
    );
  }

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  const byStage = deals.reduce<Record<string, Deal[]>>((acc, d) => {
    (acc[d.stage] ??= []).push(d);
    return acc;
  }, {});
  const stages = dealStages.length > 0 ? dealStages : [{ id: "_", name: "New", sortOrder: 0 }];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Pipeline</h1>
          <p className="mt-2 text-muted-foreground">
            Deals and opportunities for {activeBiz?.name ?? "this business"}.
          </p>
        </div>
        <div className="flex gap-2">
          {showAddStage ? (
            <div className="flex gap-2 items-center">
              <input
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Stage name"
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
              />
              <Button onClick={handleAddStage}>Add</Button>
              <Button variant="outline" onClick={() => setShowAddStage(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowAddStage(true)}>
              Add stage
            </Button>
          )}
          {showAddDeal ? (
            <div className="flex gap-2 items-center flex-wrap">
              <input
                className="rounded-md border border-input bg-background px-3 py-2 text-sm w-40"
                placeholder="Deal title"
                value={newDealTitle}
                onChange={(e) => setNewDealTitle(e.target.value)}
              />
              <input
                className="rounded-md border border-input bg-background px-3 py-2 text-sm w-24"
                placeholder="Amount"
                type="number"
                value={newDealAmount}
                onChange={(e) => setNewDealAmount(e.target.value)}
              />
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newDealStage}
                onChange={(e) => setNewDealStage(e.target.value)}
              >
                {dealStages.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              <Button onClick={handleAddDeal}>Create</Button>
              <Button variant="outline" onClick={() => setShowAddDeal(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button onClick={() => setShowAddDeal(true)}>Add deal</Button>
          )}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <div className="flex gap-4 min-w-max">
          {stages.map((stage) => (
            <div
              key={stage.id}
              className="w-64 shrink-0 rounded-lg border border-border bg-card p-4"
            >
              <h3 className="font-medium text-foreground">{stage.name}</h3>
              <ul className="mt-3 space-y-2">
                {(byStage[stage.name] ?? []).map((deal) => (
                  <li
                    key={deal.id}
                    className="rounded-md border border-border bg-background p-3 text-sm group"
                  >
                    <p className="font-medium text-foreground">{deal.title}</p>
                    {deal.amount != null && (
                      <p className="mt-1 text-muted-foreground">
                        ₱{deal.amount.toLocaleString()}
                      </p>
                    )}
                    {dealStages.length > 1 && (
                      <div className="mt-2 flex flex-wrap gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {dealStages
                          .filter((s) => s.name !== deal.stage)
                          .map((s) => (
                            <Button
                              key={s.id}
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs"
                              disabled={movingId === deal.id}
                              onClick={() => handleMoveDeal(deal.id, s.name)}
                            >
                              → {s.name}
                            </Button>
                          ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {deals.length === 0 && (
        <p className="mt-6 text-muted-foreground">
          No deals yet. Create your first deal to get started.
        </p>
      )}
    </div>
  );
}

export default function PipelinePage() {
  if (!hasClerk) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Pipeline</h1>
        <p className="mt-2 text-muted-foreground">
          Clerk authentication is not configured.
        </p>
      </div>
    );
  }
  return <PipelinePageContent />;
}
