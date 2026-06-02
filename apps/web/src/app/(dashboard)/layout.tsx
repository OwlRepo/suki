import { ReactNode } from "react";
import { DashboardNav } from "@/components/dashboard-nav";
import { RequireSession } from "@/components/require-session";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <RequireSession>
      <DashboardNav>{children}</DashboardNav>
    </RequireSession>
  );
}
