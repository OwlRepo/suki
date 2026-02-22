"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { useAuthSync } from "@/hooks/use-auth-sync";
import { hasClerk } from "@/lib/clerk";
import { useWorkspace } from "@/contexts/workspace-context";
import { recordOnboardingEvent } from "@/lib/onboarding-metrics";

const BUSINESS_TYPES = [
  { value: "salon", label: "Salon / Hair & Beauty" },
  { value: "clinic", label: "Clinic / Healthcare" },
  { value: "restaurant", label: "Restaurant / Cafe" },
  { value: "retail", label: "Retail / Shop" },
  { value: "spa", label: "Spa / Wellness" },
  { value: "gym", label: "Gym / Fitness" },
  { value: "other", label: "Other business" },
];

/** Map business type to workflow profile for capability templates */
const WORKFLOW_PROFILE_BY_TYPE: Record<string, string> = {
  salon: "service_scheduling",
  clinic: "service_scheduling",
  spa: "service_scheduling",
  gym: "service_scheduling",
  restaurant: "general",
  retail: "general",
  other: "general",
};

const MODULE_LABELS: Record<string, string> = {
  crm: "Customer list — Add and manage your customers",
  appointments: "Appointments — Schedule and track bookings",
  loyalty: "Loyalty — Reward regular visitors",
  promos: "Promotions — Send offers and follow-ups",
  insights: "Customer insights — See who comes back and when",
  ai_messaging: "AI-assisted messages — Write better promos with AI help",
};

type Step = "questions" | "recommendations";

function SetupPageContent() {
  const router = useRouter();
  const { getToken } = useAuth();
  const workspace = useWorkspace();
  const { data: syncData, loading: syncLoading } = useAuthSync();
  const [step, setStep] = useState<Step>("questions");
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [recommendedModules, setRecommendedModules] = useState<string[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (step === "recommendations" && businessType) {
      setRecommendationsLoading(true);
      (async () => {
        try {
          const token = await getToken();
          if (!token) return;
          const res = await apiRequest<{ recommendedModules: string[] }>(
            `/organizations/me/recommendations?businessType=${encodeURIComponent(businessType)}`,
            { token },
          );
          setRecommendedModules(res.recommendedModules ?? []);
        } catch {
          setRecommendedModules([]);
        } finally {
          setRecommendationsLoading(false);
        }
      })();
    }
  }, [step, businessType, getToken]);

  const handleQuestionsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !businessType) {
      setError("Please enter your business name and select a type.");
      return;
    }
    setError(null);
    setStep("recommendations");
  };

  const handleCreateBusiness = async () => {
    setSubmitting(true);
    setError(null);
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
      await workspace?.refetch?.();
      recordOnboardingEvent("setup_completed", syncData?.organization?.id ?? null);
      router.push("/onboarding");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create business. Please try again.";
      if (msg === "PLAN_BUSINESS_LIMIT_REACHED") {
        setError("Your plan limit for businesses has been reached. Upgrade your plan in Settings to add more.");
      } else {
        setError(msg);
      }
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    setStep("questions");
    setError(null);
  };

  if (syncLoading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <p className="text-base text-muted-foreground">Loading…</p>
      </div>
    );
  }
  if (!syncData) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <p className="text-base text-muted-foreground">
          Sign in to set up your business.
        </p>
      </div>
    );
  }

  if (step === "questions") {
    return (
      <div className="mx-auto max-w-md">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Step 1 of 2
        </p>
        <h1 className="text-2xl font-semibold text-foreground">
          Business setup
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          This helps us adjust the app for how you work. You can change this anytime.
        </p>
        <form onSubmit={handleQuestionsSubmit} className="mt-6 space-y-5">
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
          <Button type="submit" size="lg" className="min-h-[44px] w-full text-base">
            Continue
          </Button>
        </form>
      </div>
    );
  }

  if (step === "recommendations") {
    const typeLabel =
      BUSINESS_TYPES.find((t) => t.value === businessType)?.label ?? businessType;

    return (
      <div className="mx-auto max-w-md">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Step 2 of 2
        </p>
        <h1 className="text-2xl font-semibold text-foreground">
          Recommended for {name.trim()}
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          For a {typeLabel}, these features will help most. Others are optional — you can enable them later.
        </p>

        {recommendationsLoading ? (
          <p className="mt-6 text-base text-muted-foreground">Loading recommendations…</p>
        ) : (
          <ul className="mt-6 space-y-3" role="list">
            {recommendedModules.slice(0, 3).map((m) => (
              <li
                key={m}
                className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4"
              >
                <span className="text-base font-medium text-foreground">
                  {MODULE_LABELS[m] ?? m}
                </span>
              </li>
            ))}
            {recommendedModules.length > 3 && (
              <li className="rounded-lg border border-border bg-muted/30 p-4">
                <span className="text-base text-muted-foreground">
                  Optional — enable later: {recommendedModules.slice(3).map((m) => MODULE_LABELS[m] ?? m).join(", ")}
                </span>
              </li>
            )}
            {recommendedModules.length > 0 && recommendedModules.length <= 3 && (
              <p className="text-sm text-muted-foreground">
                You can explore more features after setup.
              </p>
            )}
            {recommendedModules.length === 0 && (
              <p className="text-base text-muted-foreground">
                No specific recommendations. You can explore all features after setup.
              </p>
            )}
          </ul>
        )}

        {error && (
          <div className="mt-4 space-y-2" role="alert">
            <p className="text-base text-destructive">{error}</p>
            {error.includes("Upgrade your plan") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/settings")}
                className="mt-2"
              >
                Go to Settings to upgrade
              </Button>
            )}
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse sm:justify-between">
          <Button
            size="lg"
            onClick={handleCreateBusiness}
            disabled={submitting || recommendationsLoading}
            className="min-h-[44px] flex-1 text-base sm:flex-none"
          >
            {submitting ? "Creating…" : "Create business"}
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={handleBack}
            disabled={submitting}
            className="min-h-[44px] flex-1 text-base sm:flex-none"
          >
            Back
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

export default function SetupPage() {
  if (!hasClerk) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-muted-foreground">
          Clerk authentication is not configured. Set
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to set up your business.
        </p>
      </div>
    );
  }
  return <SetupPageContent />;
}
