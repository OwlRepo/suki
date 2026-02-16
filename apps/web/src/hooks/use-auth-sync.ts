"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

interface SyncResult {
  user: { id: string; organizationId: string };
  organization: { id: string; name: string };
  isNew: boolean;
}

export function useAuthSync() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [data, setData] = useState<SyncResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const result = await apiRequest<SyncResult>("/auth/sync", {
          method: "POST",
          token,
        });
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Sync failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  return { data, loading, error };
}
