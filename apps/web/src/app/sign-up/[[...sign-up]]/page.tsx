"use client";

import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

import { hasClerk } from "@/lib/clerk";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { Button } from "@/components/ui/button";

export default function SignUpPage() {
  const flags = useFeatureFlags();
  if (!hasClerk) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">
          Clerk authentication is not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to sign up.
        </p>
      </div>
    );
  }
  if (!flags.public_signup_enabled) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
        <h1 className="text-xl font-semibold text-foreground">
          Invite-only access
        </h1>
        <p className="max-w-md text-center text-muted-foreground">
          Suki access is by invitation. Contact us to get started.
        </p>
        <Button asChild size="lg">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp signInUrl="/sign-in" forceRedirectUrl="/dashboard" />
    </div>
  );
}
