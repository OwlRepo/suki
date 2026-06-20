import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { AlertCircle } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { DesktopSidebarNav } from "./desktop-sidebar-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("DesktopSidebarNav badges", () => {
  it("shows badges, caps 99+, and hides zero", () => {
    render(
      <DesktopSidebarNav
        groups={[
          {
            key: "daily",
            label: "Daily tasks",
            items: [
              {
                href: "/needs-attention",
                label: "Needs Attention",
                icon: AlertCircle,
                badgeCount: 120,
              },
              {
                href: "/empty",
                label: "Empty",
                icon: AlertCircle,
                badgeCount: 0,
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("99+")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("keeps icon-only nav accessible when collapsed", () => {
    render(
      <DesktopSidebarNav
        collapsed
        groups={[
          {
            key: "daily",
            label: "Daily tasks",
            items: [
              {
                href: "/dashboard",
                label: "Dashboard",
                icon: AlertCircle,
                badgeCount: 120,
              },
            ],
          },
        ]}
      />,
    );

    const link = screen.getByRole("link", { name: "Dashboard" });

    expect(link).toHaveAttribute("title", "Dashboard");
    expect(link).toHaveAttribute("aria-current", "page");
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.getByText("99+")).toBeInTheDocument();
  });
});
