"use client";

import { SignUp } from "@clerk/nextjs";

import { hasClerk } from "@/lib/clerk";

export default function SignUpPage() {
  if (!hasClerk) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">
          Clerk authentication is not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to sign up.
        </p>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp signInUrl="/sign-in" forceRedirectUrl="/dashboard" />
    </div>
  );
}
