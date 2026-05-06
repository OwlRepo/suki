import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarDays,
  Home,
  Import,
  Settings,
  Settings2,
  Users,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

/**
 * Returns dashboard nav groups for the freemium MVP scope.
 */
export function getDashboardNavGroups(_showPipeline: boolean): NavGroup[] {
  const dailyItems: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/customers", label: "Customers", icon: Users },
    { href: "/appointments", label: "Appointments", icon: CalendarDays },
  ];

  return [
    { key: "daily", label: "Daily work", items: dailyItems },
    {
      key: "growth",
      label: "Growth",
      items: [
        { href: "/insights", label: "Business summary", icon: BarChart3 },
        { href: "/analytics", label: "Usage analytics", icon: BarChart3 },
      ],
    },
    {
      key: "admin",
      label: "Admin",
      items: [
        { href: "/imports", label: "Import", icon: Import },
        { href: "/setup", label: "Setup", icon: Settings2 },
        { href: "/settings", label: "Settings", icon: Settings },
      ],
    },
  ];
}

/** Top items for mobile bottom nav (most-used flows). */
export function getMobileBottomNavItems(_showPipeline: boolean): NavItem[] {
  const items: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/customers", label: "Customers", icon: Users },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
  ];
  return items;
}
