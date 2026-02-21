"use client";

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@suki/ui";
import { apiRequest } from "@/lib/api";
import { useWorkspace } from "@/contexts/workspace-context";

const BUSINESS_TYPES = [
  { value: "salon", label: "Salon / Hair & Beauty", example: "Hair salons, barbershops, beauty services" },
  { value: "clinic", label: "Clinic / Healthcare", example: "Medical clinics, dental practices" },
  { value: "restaurant", label: "Restaurant / Cafe", example: "Restaurants, cafes, catering" },
  { value: "retail", label: "Retail / Shop", example: "Boutiques, specialty shops" },
  { value: "spa", label: "Spa / Wellness", example: "Day spas, massage, wellness centers" },
  { value: "gym", label: "Gym / Fitness", example: "Gyms, fitness studios, personal training" },
  { value: "other", label: "Other business", example: "Any other service or retail business" },
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
  const [justCreated, setJustCreated] = useState(false);

  useEffect(() => {
    if (alreadyHasBusiness) {
      onBusinessCreated();
    }
  }, [alreadyHasBusiness, onBusinessCreated, workspace?.businesses?.length]);

  if (alreadyHasBusiness) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-6">
        <p className="text-base text-muted-foreground">
          {justCreated ? "Business created. Moving to next step…" : "Loading next step…"}
        </p>
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
      setJustCreated(true);
      await workspace?.refetch?.();
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Failed to create business. Please try again.";
      if (msg === "PLAN_BUSINESS_LIMIT_REACHED") {
        setError(
          "You've reached the maximum number of businesses on your plan. To add more, go to Settings and upgrade your plan."
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
        {businessType && (
          <p className="mt-1 text-sm text-muted-foreground">
            {BUSINESS_TYPES.find((t) => t.value === businessType)?.example}
          </p>
        )}
      </div>

      <details className="group rounded-md border border-border bg-muted/30">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
          <span>Why do we ask this?</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <p className="leading-relaxed">
            We use your business type to show you the right words and suggestions. For example,
            clinics see "patients" instead of "customers," and salons see service-focused prompts.
            You can change this anytime in Settings.
          </p>
        </div>
      </details>

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
