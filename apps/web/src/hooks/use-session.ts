"use client";

import { useEffect, useState } from "react";
import { getSession } from "@/lib/auth-client";

type SessionState = {
  loading: boolean;
  isSignedIn: boolean;
  user: { id: string; email?: string } | null;
};

let cachedResolved: Omit<SessionState, "loading"> | null = null;
let inFlight: Promise<Omit<SessionState, "loading">> | null = null;

async function loadSessionOnce(): Promise<Omit<SessionState, "loading">> {
  if (cachedResolved) return cachedResolved;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const data = await getSession();
      const resolved = data?.user
        ? { isSignedIn: true, user: data.user as { id: string; email?: string } }
        : { isSignedIn: false, user: null };
      cachedResolved = resolved;
      return resolved;
    } catch {
      const resolved = { isSignedIn: false, user: null };
      cachedResolved = resolved;
      return resolved;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function __resetSessionCacheForTests() {
  cachedResolved = null;
  inFlight = null;
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>(() => {
    if (cachedResolved) {
      return { loading: false, ...cachedResolved };
    }
    return { loading: true, isSignedIn: false, user: null };
  });

  useEffect(() => {
    if (cachedResolved) {
      return;
    }

    let active = true;
    loadSessionOnce().then((resolved) => {
      if (!active) return;
      setState({ loading: false, ...resolved });
    });

    return () => {
      active = false;
    };
  }, []);

  return state;
}
