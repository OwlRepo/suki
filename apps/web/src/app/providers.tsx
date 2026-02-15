"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isPlaceholder =
  !publishableKey || publishableKey.includes("placeholder");

export function Providers({ children }: { children: React.ReactNode }) {
  const content = (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );

  if (isPlaceholder) {
    return content;
  }
  return (
    <ClerkProvider publishableKey={publishableKey}>{content}</ClerkProvider>
  );
}
