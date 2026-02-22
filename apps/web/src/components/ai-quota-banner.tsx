"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface AiSummary {
  plan: string;
  tokensUsed: number;
  tokensLimit: number;
  requestsUsed: number;
  requestsLimit: number;
  aiEnabled: boolean;
}

export function AiQuotaBanner() {
  const { getToken } = useAuth();
  const flags = useFeatureFlags();
  const [summary, setSummary] = useState<AiSummary | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await apiRequest<AiSummary>("/ai/usage/summary", { token });
        setSummary(res);
      } catch {
        setSummary(null);
      }
    })();
  }, [getToken]);

  if (!flags.ai_usage_transparency_enabled) return null;
  if (!summary || summary.tokensLimit === 0) return null;
  if (!summary.aiEnabled) return null;

  const tokenPct = summary.tokensLimit > 0 ? summary.tokensUsed / summary.tokensLimit : 0;
  const requestPct = summary.requestsLimit > 0 ? summary.requestsUsed / summary.requestsLimit : 0;
  const pct = Math.max(tokenPct, requestPct);

  if (pct < 0.7) return null;

  const variant = pct >= 0.99 ? "error" : pct >= 0.9 ? "warning" : "info";
  const variantClass =
    variant === "error"
      ? "border-destructive/50 bg-destructive/10 text-destructive"
      : variant === "warning"
        ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-300";

  return (
    <Alert variant={variant === "error" ? "destructive" : "default"} className={cn("mb-4", variantClass)}>
      <AlertDescription>
        {variant === "error" ? (
          <p>
            AI quota exceeded. Upgrade your plan or wait for reset on next month.
            <Link href="/settings" className="ml-1 underline">
              View usage
            </Link>
          </p>
        ) : (
          <p>
            AI usage at {Math.round(pct * 100)}% of monthly limit.{" "}
            <Link href="/settings" className="underline">
              Manage in Settings
            </Link>
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
