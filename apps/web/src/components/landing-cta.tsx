"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut } from "@clerk/nextjs";

import { hasClerk } from "@/lib/clerk";

interface LandingCtaProps {
  /** When true, show only the primary CTA (for hero with one dominant action) */
  singlePrimary?: boolean;
}

export function LandingCta({ singlePrimary }: LandingCtaProps) {
  if (!hasClerk) {
    return (
      <Button asChild size="lg">
        <Link href="/dashboard">Go to Dashboard</Link>
      </Button>
    );
  }
  return (
    <>
      <SignedOut>
        {singlePrimary ? (
          <Button asChild size="lg">
            <Link href="/sign-up">Start Free with CRM Lite</Link>
          </Button>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/sign-up">Start Free with CRM Lite</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        )}
      </SignedOut>
      <SignedIn>
        <Button asChild size="lg">
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </SignedIn>
    </>
  );
}
