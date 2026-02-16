"use client";

import { SignIn } from "@clerk/nextjs";

import { hasClerk } from "@/lib/clerk";

export default function SignInPage() {
  if (!hasClerk) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">
          Clerk authentication is not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to sign in.
        </p>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn signUpUrl="/sign-up" forceRedirectUrl="/dashboard" />
    </div>
  );
}
