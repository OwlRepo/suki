"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";

export function RequireSession({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { loading, isSignedIn } = useSession();

  useEffect(() => {
    if (!loading && !isSignedIn) {
      router.replace("/sign-in");
    }
  }, [loading, isSignedIn, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-base text-muted-foreground">Checking your session…</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  return <>{children}</>;
}
