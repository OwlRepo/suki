import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ClipboardList,
  FileClock,
  MessageSquareWarning,
  ShieldCheck,
} from "lucide-react";

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
      items: [
        { href: "/platform-admin", label: "Overview", icon: ShieldCheck },
        { href: "/platform-admin/businesses", label: "Businesses", icon: Building2 },
        {
          href: "/platform-admin/billing-requests",
          label: "Billing Requests",
          icon: ClipboardList,
        },
        {
          href: "/platform-admin/communications",
          label: "Communications",
          icon: MessageSquareWarning,
        },
        { href: "/platform-admin/audit-logs", label: "Audit Logs", icon: FileClock },
      ],
    },
  ];
}
