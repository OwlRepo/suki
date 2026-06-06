"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPlatformAdminSession } from "./platform-admin.api";

type AccessState = "loading" | "authorized" | "redirecting";

export function RequirePlatformAdmin({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AccessState>("loading");

  useEffect(() => {
    let active = true;

    getPlatformAdminSession()
      .then(() => {
        if (active) setState("authorized");
      })
      .catch((error: Error & { status?: number }) => {
        if (!active) return;
        setState("redirecting");
        router.replace(error.status === 401 ? "/sign-in" : "/dashboard");
      });

    return () => {
      active = false;
    };
  }, [router]);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-base text-muted-foreground">
          Checking internal access...
        </p>
      </div>
    );
  }

  if (state === "redirecting") {
    return null;
  }

  return <>{children}</>;
}
