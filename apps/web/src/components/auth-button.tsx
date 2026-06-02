"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { invalidateSessionCache, useSession } from "@/hooks/use-session";

export function AuthButton() {
  const router = useRouter();
  const { isSignedIn } = useSession();
  if (!isSignedIn) return null;

  return (
    <Button
      variant="outline"
      onClick={async () => {
        await signOut();
        invalidateSessionCache();
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
