import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarDays,
  Gift,
  Home,
  Import,
  Megaphone,
  Settings,
  Settings2,
  Users,
  KanbanSquare,
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
 * Returns dashboard nav groups. Pipeline is included only when showPipeline is true.
 */
export function getDashboardNavGroups(showPipeline: boolean): NavGroup[] {
  const dailyItems: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/customers", label: "Customers", icon: Users },
    { href: "/appointments", label: "Appointments", icon: CalendarDays },
  ];
  if (showPipeline) {
    dailyItems.push({ href: "/pipeline", label: "Pipeline", icon: KanbanSquare });
  }

  return [
    { key: "daily", label: "Daily work", items: dailyItems },
    {
      key: "growth",
      label: "Growth",
      items: [
        { href: "/promos", label: "Promos", icon: Megaphone },
        { href: "/insights", label: "Business summary", icon: BarChart3 },
        { href: "/loyalty", label: "Loyalty", icon: Gift },
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
export function getMobileBottomNavItems(showPipeline: boolean): NavItem[] {
  const items: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/customers", label: "Customers", icon: Users },
    { href: "/appointments", label: "Appointments", icon: CalendarDays },
  ];
  if (showPipeline) {
    items.push({ href: "/pipeline", label: "Pipeline", icon: KanbanSquare });
  }
  return items;
}
