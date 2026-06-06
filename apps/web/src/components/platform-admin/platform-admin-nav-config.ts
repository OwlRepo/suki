import type { LucideIcon } from "lucide-react";
import { ShieldCheck } from "lucide-react";

export interface PlatformAdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface PlatformAdminNavGroup {
  key: string;
  label: string;
  items: PlatformAdminNavItem[];
}

export function getPlatformAdminNavGroups(): PlatformAdminNavGroup[] {
  return [
    {
      key: "operations",
      label: "Operations",
      items: [{ href: "/platform-admin", label: "Overview", icon: ShieldCheck }],
    },
  ];
}
