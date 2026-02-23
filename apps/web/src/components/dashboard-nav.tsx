"use client";

import { AdaptiveAppShell } from "@/components/navigation/adaptive-app-shell";

export function DashboardNav({ children }: { children: React.ReactNode }) {
  return <AdaptiveAppShell>{children}</AdaptiveAppShell>;
}
