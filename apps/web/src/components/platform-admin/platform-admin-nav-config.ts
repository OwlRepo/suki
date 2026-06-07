import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
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
        {
          href: "/platform-admin/communications",
          label: "Communications",
          icon: MessageSquareWarning,
        },
        {
          href: "/platform-admin/automation-runs",
          label: "Automation Runs",
          icon: Activity,
        },
        { href: "/platform-admin/alerts", label: "Alerts", icon: Bell },
      ],
    },
    {
      key: "customers",
      label: "Customers",
      items: [
        { href: "/platform-admin/businesses", label: "Businesses", icon: Building2 },
      ],
    },
    {
      key: "billing",
      label: "Billing",
      items: [
        {
          href: "/platform-admin/billing-requests",
          label: "Billing Requests",
          icon: ClipboardList,
        },
      ],
    },
    {
      key: "security",
      label: "Security",
      items: [
        { href: "/platform-admin/audit-logs", label: "Audit Logs", icon: FileClock },
      ],
    },
  ];
}
