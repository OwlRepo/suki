"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { useSession } from "@/hooks/use-session";

interface LandingCtaProps {
  singlePrimary?: boolean;
}

export function LandingCta({ singlePrimary }: LandingCtaProps) {
  const flags = useFeatureFlags();
  const { isSignedIn } = useSession();

  if (isSignedIn) {
    return (
      <Button asChild size="lg" className="w-full sm:w-auto">
        <Link href="/dashboard" className="w-full sm:w-auto">
          Go to Dashboard
        </Link>
      </Button>
    );
  }

  if (singlePrimary) {
    return (
      <Button asChild size="lg" className="w-full sm:w-auto">
        <Link href="/sign-in">Log in</Link>
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
      <Button asChild size="lg" className="w-full sm:w-auto">
        <Link href="/sign-in">Log in</Link>
      </Button>
      {flags.public_signup_enabled && (
        <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
          <Link href="/sign-up">Try Tyvera Free</Link>
        </Button>
      )}
    </div>
  );
}
