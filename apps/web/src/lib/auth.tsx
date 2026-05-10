"use client";

import { useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { signOut } from "@/lib/auth-client";

export function useAuth() {
  const { isSignedIn, loading, user } = useSession();

  const getToken = useCallback(async () => "cookie-session", []);

  return useMemo(
    () => ({
      isLoaded: !loading,
      isSignedIn,
      userId: user?.id ?? null,
      getToken,
    }),
    [loading, isSignedIn, user?.id, getToken],
  );
}

export function SignedIn({ children }: { children: ReactNode }) {
  const { isSignedIn } = useSession();
  if (!isSignedIn) return null;
  return <>{children}</>;
}

export function SignedOut({ children }: { children: ReactNode }) {
  const { isSignedIn } = useSession();
  if (isSignedIn) return null;
  return <>{children}</>;
}

export function UserButton({ afterSignOutUrl = "/" }: { afterSignOutUrl?: string }) {
  const router = useRouter();
  return (
    <button
      className="rounded border px-3 py-1 text-sm"
      onClick={async () => {
        await signOut();
        router.push(afterSignOutUrl);
      }}
    >
      Sign out
    </button>
  );
}
