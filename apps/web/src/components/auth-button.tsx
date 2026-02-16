"use client";

import { UserButton } from "@clerk/nextjs";

import { hasClerk } from "@/lib/clerk";

export function AuthButton() {
  if (!hasClerk) return null;
  return <UserButton afterSignOutUrl="/" />;
}
