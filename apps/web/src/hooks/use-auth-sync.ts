"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";

interface SyncResult {
  user: { id: string; organizationId: string };
  organization: { id: string; name: string };
  isNew: boolean;
}

// Module-level in-flight dedupe: one sync request per clerk user id.
const inFlight = new Map<string, Promise<SyncResult>>();
const resultCache = new Map<string, SyncResult>();

async function syncAuthForUser(
  userId: string,
  getToken: () => Promise<string | null>
): Promise<SyncResult> {
  const cached = resultCache.get(userId);
  if (cached) return cached;

  const existing = inFlight.get(userId);
  if (existing) return existing;

  const promise = (async (): Promise<SyncResult> => {
    const token = await getToken();
    if (!token) throw new Error("No token");
    const result = await apiRequest<SyncResult>("/auth/sync", {
      method: "POST",
      token,
    });
    resultCache.set(userId, result);
    return result;
  })();

  inFlight.set(userId, promise);
  try {
    const result = await promise;
    return result;
  } finally {
    inFlight.delete(userId);
  }
}

export function useAuthSync() {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [retryTrigger, setRetryTrigger] = useState(0);
  const [data, setData] = useState<SyncResult | null>(() =>
    userId ? resultCache.get(userId) ?? null : null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const retry = () => {
    if (userId) invalidateSyncForUser(userId);
    setError(null);
    setRetryTrigger((t) => t + 1);
  };

  useEffect(() => {
    if (!isLoaded) {
      setLoading(false);
      return;
    }
    if (!isSignedIn || !userId) {
      resultCache.clear();
      inFlight.clear();
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    syncAuthForUser(userId, () => getTokenRef.current())
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e) => {
        if (!cancelled) {
          const err = e as Error & { status?: number; message?: string };
          const isAccessDenied =
            err.status === 403 ||
            (typeof err.message === "string" &&
              err.message.toLowerCase().includes("invite-only"));
          setError(
            isAccessDenied
              ? "Access is invite-only. Contact us to get started."
              : err?.message ?? "Sync failed",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId, retryTrigger]);

  return { data, loading, error, retry };
}

/** Invalidate cached sync for a user (e.g. before retry). */
export function invalidateSyncForUser(userId: string) {
  inFlight.delete(userId);
  resultCache.delete(userId);
}

/** Reset module-level cache; use in tests only. */
export function __resetAuthSyncForTests() {
  inFlight.clear();
  resultCache.clear();
}
