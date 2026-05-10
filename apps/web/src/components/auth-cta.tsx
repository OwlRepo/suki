"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";

export function AuthCta() {
  const { isSignedIn } = useSession();
  if (!isSignedIn) {
    return (
      <Button asChild className="min-w-[100px] sm:min-w-0">
        <Link href="/sign-in">Log in</Link>
      </Button>
    );
  }
  return (
    <Button asChild className="min-w-[100px] sm:min-w-0">
      <Link href="/dashboard">Go to Dashboard</Link>
    </Button>
  );
}
