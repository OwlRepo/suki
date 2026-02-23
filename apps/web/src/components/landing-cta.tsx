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
      <Button asChild size="lg" className="w-full sm:w-auto">
        <Link href="/dashboard" className="w-full sm:w-auto">
          Go to Dashboard
        </Link>
      </Button>
    );
  }
  return (
    <>
      <SignedOut>
        {singlePrimary ? (
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/sign-up">Try Suki Free</Link>
          </Button>
        ) : (
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/sign-up">Try Suki Free</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        )}
      </SignedOut>
      <SignedIn>
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href="/dashboard" className="w-full sm:w-auto">
            Go to Dashboard
          </Link>
        </Button>
      </SignedIn>
    </>
  );
}
