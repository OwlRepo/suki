"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut } from "@clerk/nextjs";

import { hasClerk } from "@/lib/clerk";
import { useFeatureFlags } from "@/hooks/use-feature-flags";

const REQUEST_ACCESS_URL =
  process.env.NEXT_PUBLIC_REQUEST_ACCESS_URL ||
  "mailto:romeo.webeng@gmail.com?subject=Request%20access%20to%20Suki";

interface LandingCtaProps {
  /** When true, show only the primary CTA (for hero with one dominant action) */
  singlePrimary?: boolean;
}

export function LandingCta({ singlePrimary }: LandingCtaProps) {
  const flags = useFeatureFlags();
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
        {flags.public_signup_enabled ? (
          singlePrimary ? (
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
          )
        ) : (
          <Button asChild size="lg" className="w-full sm:w-auto">
            <a href={REQUEST_ACCESS_URL}>Request access</a>
          </Button>
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
