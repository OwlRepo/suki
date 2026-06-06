import { ReactNode } from "react";
import { RequireSession } from "@/components/require-session";
import { PlatformAdminShell } from "@/components/platform-admin/platform-admin-shell";
import { RequirePlatformAdmin } from "@/components/platform-admin/require-platform-admin";

export default function PlatformAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RequireSession>
      <RequirePlatformAdmin>
        <PlatformAdminShell>{children}</PlatformAdminShell>
      </RequirePlatformAdmin>
    </RequireSession>
  );
}
