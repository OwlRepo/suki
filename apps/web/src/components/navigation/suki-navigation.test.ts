import { describe, expect, it } from "vitest";
import { getDashboardNavGroups, getMobileBottomNavItems } from "./dashboard-nav-config";

describe("Suki direct navigation", () => {
  it("edge: keeps usage analytics gated while billing remains discoverable", () => {
    const items = getDashboardNavGroups(false, { canSeeAiAnalytics: false }, 0).flatMap((group) => group.items);
    expect(items.some((item) => item.href === "/analytics")).toBe(false);
    expect(items).toContainEqual(expect.objectContaining({ href: "/settings/billing", label: "Plan & usage" }));
  });

  it("regression: exposes Today, billing, imports and attention without a settings detour", () => {
    const items = getDashboardNavGroups(false, { canSeeAiAnalytics: true }, 4).flatMap((group) => group.items);
    expect(items).toEqual(expect.arrayContaining([
      expect.objectContaining({ href: "/dashboard", label: "Today" }),
      expect.objectContaining({ href: "/settings/billing", label: "Plan & usage" }),
      expect.objectContaining({ href: "/imports", label: "Import customers" }),
      expect.objectContaining({ href: "/needs-attention", badgeCount: 4 }),
    ]));
  });

  it("regression: puts daily actions in mobile quick navigation", () => {
    expect(getMobileBottomNavItems(false)).toEqual([
      expect.objectContaining({ href: "/dashboard", label: "Today" }),
      expect.objectContaining({ href: "/appointments", label: "Appointments" }),
      expect.objectContaining({ href: "/needs-attention", label: "Attention" }),
    ]);
  });
});
