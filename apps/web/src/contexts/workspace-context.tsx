"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiRequest } from "@/lib/api";

export interface WorkspaceBusiness {
  id: string;
  name: string;
  businessType?: string;
  crmMode: "lite" | "full";
  workflowProfile: string;
}

export interface WorkspaceContextValue {
  activeBusinessId: string | null;
  businesses: WorkspaceBusiness[];
  setActiveBusinessId: (id: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  children,
  getToken,
  enabled = true,
}: {
  children: ReactNode;
  getToken: () => Promise<string | null>;
  enabled?: boolean;
}) {
  const [activeBusinessId, setActiveBusinessIdState] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<WorkspaceBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspace = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setBusinesses([]);
        setActiveBusinessIdState(null);
        return;
      }
      const res = await apiRequest<{
        activeBusinessId: string | null;
        businesses: Array<{
          id: string;
          name: string;
          businessType?: string;
          crmMode: string;
          workflowProfile: string;
        }>;
      }>("/users/me/workspace", { token });
      setBusinesses(
        res.businesses.map((b) => ({
          id: b.id,
          name: b.name,
          businessType: b.businessType,
          crmMode: (b.crmMode as "lite" | "full") || "lite",
          workflowProfile: b.workflowProfile || "general",
        })),
      );
      setActiveBusinessIdState(res.activeBusinessId);
    } catch (err) {
      setBusinesses([]);
      setActiveBusinessIdState(null);
      setError(err instanceof Error ? err.message : "Failed to load workspace");
    } finally {
      setLoading(false);
    }
  }, [getToken, enabled]);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  const setActiveBusinessId = useCallback(
    async (id: string) => {
      const token = await getToken();
      if (!token) return;
      try {
        await apiRequest("/users/me/workspace", {
          method: "PATCH",
          token,
          body: JSON.stringify({ activeBusinessId: id }),
        });
        setActiveBusinessIdState(id);
      } catch {
        // Refetch on error to restore consistent state
        await fetchWorkspace();
      }
    },
    [getToken, fetchWorkspace],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      activeBusinessId,
      businesses,
      setActiveBusinessId,
      loading,
      error,
      refetch: fetchWorkspace,
    }),
    [activeBusinessId, businesses, setActiveBusinessId, loading, error, fetchWorkspace],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  return ctx;
}
