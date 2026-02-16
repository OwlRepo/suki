"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut } from "@clerk/nextjs";

import { hasClerk } from "@/lib/clerk";

export function AuthCta() {
  if (!hasClerk) {
    return (
      <Button asChild>
        <Link href="/dashboard">Go to Dashboard</Link>
      </Button>
    );
  }
  return (
    <>
      <SignedOut>
        <Button asChild>
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </SignedOut>
      <SignedIn>
        <Button asChild>
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </SignedIn>
    </>
  );
}
