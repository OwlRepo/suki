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
});
