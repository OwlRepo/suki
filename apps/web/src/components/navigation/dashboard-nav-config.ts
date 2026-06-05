import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarDays,
  CircleHelp,
  AlertCircle,
  Home,
  Import,
  Settings,
  Settings2,
  Share2,
} from "lucide-react";
import type { PlanCapabilities } from "@/lib/plan-capabilities";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badgeCount?: number;
}

export interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

/**
 * Returns dashboard nav groups for the freemium MVP scope.
 */
export function getDashboardNavGroups(
  _showPipeline: boolean,
  capabilities: Pick<PlanCapabilities, "canSeeAiAnalytics"> = {
    canSeeAiAnalytics: true,
  },
  needsAttentionCount = 0,
): NavGroup[] {
  const dailyItems: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/appointments", label: "Appointments", icon: CalendarDays },
    { href: "/share-slots", label: "Share slots", icon: Share2 },
    {
      href: "/needs-attention",
      label: "Needs Attention",
      icon: AlertCircle,
      badgeCount: needsAttentionCount,
    },
  ];

  return [
    { key: "daily", label: "Daily tasks", items: dailyItems },
    {
      key: "growth",
      label: "Business growth",
      items: [
        { href: "/insights", label: "Business summary", icon: BarChart3 },
        ...(capabilities.canSeeAiAnalytics
          ? [{ href: "/analytics", label: "Usage analytics", icon: BarChart3 }]
          : []),
      ],
    },
    {
      key: "admin",
      label: "Setup and admin",
      items: [
        { href: "/imports", label: "Import", icon: Import },
        { href: "/setup", label: "Setup", icon: Settings2 },
        { href: "/settings", label: "Settings", icon: Settings },
        { href: "/help", label: "Help Center", icon: CircleHelp },
      ],
    },
  ];
}

/** Top items for mobile bottom nav (most-used flows). */
export function getMobileBottomNavItems(_showPipeline: boolean): NavItem[] {
  const items: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/appointments", label: "Appointments", icon: CalendarDays },
    { href: "/insights", label: "Summary", icon: BarChart3 },
  ];
  return items;
}
