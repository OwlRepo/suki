"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut } from "@clerk/nextjs";

import { hasClerk } from "@/lib/clerk";

const REQUEST_ACCESS_URL =
  process.env.NEXT_PUBLIC_REQUEST_ACCESS_URL ||
  "mailto:romeo.webeng@gmail.com?subject=Request%20access%20to%20Suki";

export function AuthCta() {
  if (!hasClerk) {
    return (
      <Button asChild className="min-w-[100px] sm:min-w-0">
        <Link href="/dashboard">Go to Dashboard</Link>
      </Button>
    );
  }
  return (
    <>
      <SignedOut>
        <Button asChild className="min-w-[100px] sm:min-w-0">
          <a href={REQUEST_ACCESS_URL}>Request access</a>
        </Button>
      </SignedOut>
      <SignedIn>
        <Button asChild className="min-w-[100px] sm:min-w-0">
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </SignedIn>
    </>
  );
}
