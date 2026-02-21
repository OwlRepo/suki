"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@suki/ui";
import { apiRequest } from "@/lib/api";
import { useWorkspace } from "@/contexts/workspace-context";

const BUSINESS_TYPES = [
  { value: "salon", label: "Salon / Hair & Beauty" },
  { value: "clinic", label: "Clinic / Healthcare" },
  { value: "restaurant", label: "Restaurant / Cafe" },
  { value: "retail", label: "Retail / Shop" },
  { value: "spa", label: "Spa / Wellness" },
  { value: "gym", label: "Gym / Fitness" },
  { value: "other", label: "Other business" },
];

const WORKFLOW_PROFILE_BY_TYPE: Record<string, string> = {
  salon: "service_scheduling",
  clinic: "service_scheduling",
  spa: "service_scheduling",
  gym: "service_scheduling",
  restaurant: "general",
  retail: "general",
  other: "general",
};

export function OnboardingSetupStep({
  onComplete,
  onBusinessCreated,
}: {
  onComplete: () => void;
  onBusinessCreated: () => void;
}) {
  const { getToken } = useAuth();
  const workspace = useWorkspace();
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyHasBusiness = (workspace?.businesses?.length ?? 0) >= 1;

  useEffect(() => {
    if (alreadyHasBusiness) {
      // #region agent log
      fetch("http://127.0.0.1:7247/ingest/fff4b1e3-aab4-44a4-abd8-c773446f506f",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"b61998"},body:JSON.stringify({sessionId:"b61998",runId:"run1",hypothesisId:"H4",location:"onboarding-setup-step.tsx:alreadyHasBusinessEffect",message:"alreadyHasBusiness effect invoked onBusinessCreated",data:{alreadyHasBusiness,businessesCount:workspace?.businesses?.length ?? 0},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      onBusinessCreated();
    }
  }, [alreadyHasBusiness, onBusinessCreated, workspace?.businesses?.length]);

  if (alreadyHasBusiness) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-6">
        <p className="text-base text-muted-foreground">Loading next step…</p>
      </div>
    );
  }

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !businessType) {
      setError("Please enter your business name and select a type.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const workflowProfile = WORKFLOW_PROFILE_BY_TYPE[businessType] ?? "general";
      await apiRequest("/businesses", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: name.trim(),
          businessType,
          workflowProfile,
        }),
      });
      // #region agent log
      fetch("http://127.0.0.1:7247/ingest/fff4b1e3-aab4-44a4-abd8-c773446f506f",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"b61998"},body:JSON.stringify({sessionId:"b61998",runId:"run1",hypothesisId:"H5",location:"onboarding-setup-step.tsx:handleCreateBusiness:afterCreate",message:"business create API succeeded",data:{alreadyHasBusiness,businessesCount:workspace?.businesses?.length ?? 0},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      await workspace?.refetch?.();
      // #region agent log
      fetch("http://127.0.0.1:7247/ingest/fff4b1e3-aab4-44a4-abd8-c773446f506f",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"b61998"},body:JSON.stringify({sessionId:"b61998",runId:"run1",hypothesisId:"H5",location:"onboarding-setup-step.tsx:handleCreateBusiness:afterRefetch",message:"workspace refetch finished, invoking onBusinessCreated",data:{alreadyHasBusiness,businessesCount:workspace?.businesses?.length ?? 0},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      onBusinessCreated();
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Failed to create business. Please try again.";
      if (msg === "PLAN_BUSINESS_LIMIT_REACHED") {
        setError(
          "Your plan limit for businesses has been reached. Upgrade your plan in Settings to add more."
        );
      } else {
        setError(msg);
      }
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleCreateBusiness} className="space-y-5">
      <div>
        <label
          htmlFor="business-name"
          className="mb-1 block text-base font-medium text-foreground"
        >
          Business name <span className="text-destructive">(Required)</span>
        </label>
        <Input
          id="business-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. My Salon"
          className="min-h-[44px] w-full text-base"
          autoFocus
        />
      </div>
      <div>
        <label
          htmlFor="business-type"
          className="mb-1 block text-base font-medium text-foreground"
        >
          Type of business <span className="text-destructive">(Required)</span>
        </label>
        <select
          id="business-type"
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value)}
          className="min-h-[44px] w-full rounded-md border border-input bg-background px-3 py-2 text-base"
        >
          <option value="">Select your business type</option>
          {BUSINESS_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p className="text-base text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        className="min-h-[44px] w-full text-base"
        disabled={submitting}
      >
        {submitting ? "Creating…" : "Create business"}
      </Button>
    </form>
  );
}
