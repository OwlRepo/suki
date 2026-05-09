import { describe, it, expect } from "vitest";
import { getDashboardNavGroups, getMobileBottomNavItems } from "./dashboard-nav-config";

describe("dashboard navigation UX", () => {
  it("uses plain language group labels", () => {
    const labels = getDashboardNavGroups(false).map((g) => g.label);
    expect(labels).toEqual(["Daily tasks", "Business growth", "Setup and admin"]);
  });

  it("keeps appointment flow discoverable in mobile quick nav", () => {
    const labels = getMobileBottomNavItems(false).map((i) => i.label);
    expect(labels).toContain("Appointments");
  });

  it("includes a dedicated share slots page in dashboard navigation", () => {
    const dailyItems = getDashboardNavGroups(false).find((g) => g.key === "daily")?.items ?? [];
    expect(dailyItems).toEqual(
      expect.arrayContaining([expect.objectContaining({ href: "/share-slots", label: "Share slots" })]),
    );
  });
});
